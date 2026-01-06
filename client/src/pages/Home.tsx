import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Monitor, Zap, Shuffle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface SpaceTrack {
  identifier: string;
  date: string;
  venue: string;
  location: string;
  filename: string;
}

// Fallback video if JSON fails to load
const FALLBACK_VIDEO = "https://ia801907.us.archive.org/28/items/ISSVideoResourceEarthViews720p/ISS%20Video%20Resource_Earth%20Views_720p.mp4";

// Fallback background image
const FALLBACK_BG = "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2072&auto=format&fit=crop";

export default function Home() {
  const [tracks, setTracks] = useState<SpaceTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<SpaceTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [videoSrc, setVideoSrc] = useState(FALLBACK_VIDEO);
  const [videoList, setVideoList] = useState<string[]>([FALLBACK_VIDEO]);
  const [showControls, setShowControls] = useState(true);
  const [errorCount, setErrorCount] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoErrorCount, setVideoErrorCount] = useState(0);
  const [useStaticBackground, setUseStaticBackground] = useState(false);
  const [intensity, setIntensity] = useState(0.5);
  const [effectSeed, setEffectSeed] = useState(0);
  
  // Refs for animation loop access
  const intensityRef = useRef(0.5);
  const effectSeedRef = useRef(0);
  const lastVideoSwitchTime = useRef<number>(0);

  // Update refs when state changes
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    effectSeedRef.current = effectSeed;
  }, [effectSeed]);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number>(0);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Audio Context
  const initAudioContext = () => {
    if (!audioContextRef.current && audioRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      // Connect audio element to analyser and destination
      if (!sourceRef.current) {
        try {
          sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        } catch (e) {
          console.error("Audio context connection error:", e);
        }
      }
      
      // Start analysis loop
      const updateAnalysis = () => {
        if (analyserRef.current && videoRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate energy bands
          const bass = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
          const mids = dataArray.slice(20, 100).reduce((a, b) => a + b, 0) / 80;
          const highs = dataArray.slice(100, 200).reduce((a, b) => a + b, 0) / 100;
          
          // Normalize values (0 to 1)
          const bassNorm = bass / 255;
          const midsNorm = mids / 255;
          const highsNorm = highs / 255;
          
          // Effects Logic
          const currentIntensity = intensityRef.current;
          const currentSeed = effectSeedRef.current;

          // STRICT OFF CHECK: If intensity is 0, disable all effects immediately
          if (currentIntensity === 0) {
            videoRef.current.style.transform = 'none';
            videoRef.current.style.filter = 'none';
            animationRef.current = requestAnimationFrame(updateAnalysis);
            return;
          }

          // Intensity 1 means MAX effects (equivalent to old Trip Mode)
          const baseIntensity = currentIntensity * 3.0; // Scale up so 1.0 is intense
          
          // Randomize effect mapping based on seed
          const seed = currentSeed;
          const p1 = (seed % 3 === 0) ? bassNorm : (seed % 3 === 1) ? midsNorm : highsNorm;
          const p2 = (seed % 3 === 0) ? midsNorm : (seed % 3 === 1) ? highsNorm : bassNorm;
          const p3 = (seed % 3 === 0) ? highsNorm : (seed % 3 === 1) ? bassNorm : midsNorm;

          const scale = 1.0 + (p1 * 0.3 * baseIntensity);
          // Only cycle hue if intensity is high enough (> 0.5)
          const autoCycle = currentIntensity > 0.5 ? (Date.now() / (200 / currentIntensity)) % 360 : 0;
          const hueRotate = (p2 * 180 * baseIntensity) + autoCycle;
          
          const brightness = 1 + (p3 * 0.8 * baseIntensity);
          const contrast = 1 + (p3 * 0.6 * baseIntensity);
          const saturation = 1 + ((p1 + p2) * 1.5 * baseIntensity);
          const blur = (p3 * 8 * baseIntensity * currentIntensity); // Blur scales with intensity

          // Apply glitch transform
          let transform = `scale(${scale})`;
          if (p1 > 0.6 && currentIntensity > 0.2) { 
             const shake = 20 * baseIntensity;
             const x = (Math.random() - 0.5) * shake;
             const y = (Math.random() - 0.5) * shake;
             const rotate = (Math.random() - 0.5) * 5 * baseIntensity;
             transform += ` translate(${x}px, ${y}px) rotate(${rotate}deg)`;
          }
          
          videoRef.current.style.transform = transform;
          videoRef.current.style.filter = `
            hue-rotate(${hueRotate}deg) 
            brightness(${brightness}) 
            contrast(${contrast}) 
            saturate(${saturation})
            blur(${blur}px)
          `;
        }
        animationRef.current = requestAnimationFrame(updateAnalysis);
      };
      updateAnalysis();
    } else if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  // Load tracks on mount
  useEffect(() => {
    // Load tracks
    fetch("/space_tracks.json")
      .then(res => res.json())
      .then((data: SpaceTrack[]) => {
        setTracks(data);
        const randomTrack = data[Math.floor(Math.random() * data.length)];
        setCurrentTrack(randomTrack);
      })
      .catch(err => {
        console.error("Failed to load tracks:", err);
      });

    // Load videos
    fetch("/space_videos.json")
      .then(res => res.json())
      .then((data: string[]) => {
        if (data && data.length > 0) {
          setVideoList(data);
          setVideoSrc(data[Math.floor(Math.random() * data.length)]);
        }
      })
      .catch(err => {
        console.error("Failed to load videos:", err);
      });
    
    // Auto-hide controls
    const resetControlsTimer = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener('mousemove', resetControlsTimer);
    window.addEventListener('click', resetControlsTimer);
    
    return () => {
      window.removeEventListener('mousemove', resetControlsTimer);
      window.removeEventListener('click', resetControlsTimer);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Handle audio playback
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      
      if (isPlaying) {
        initAudioContext();
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.error("Play error:", e);
            // If play fails, try skipping to next track after a short delay
            if (e.name === "NotSupportedError" || e.name === "Error") {
              console.log("Track format not supported or error, skipping...");
              setTimeout(playNextTrack, 1000);
            }
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, volume, isMuted, currentTrack]);

  const playNextTrack = () => {
    if (tracks.length > 0) {
      let nextTrack;
      // Prevent infinite loops if all tracks are bad
      if (errorCount > 5) {
        console.error("Too many errors, stopping playback");
        setIsPlaying(false);
        setErrorCount(0);
        return;
      }
      
      do {
        nextTrack = tracks[Math.floor(Math.random() * tracks.length)];
      } while (nextTrack === currentTrack && tracks.length > 1);
      
      setCurrentTrack(nextTrack);
      setIsPlaying(true);
      changeVideo(); // Auto-switch video on track change
    }
  };

  const handleAudioError = (e: any) => {
    console.error("Audio playback error:", e);
    setErrorCount(prev => prev + 1);
    // Auto-skip on error
    playNextTrack();
  };

  const handleVideoError = () => {
    console.error("Video playback error");
    
    // Prevent rapid switching (debounce 2 seconds)
    const now = Date.now();
    if (now - lastVideoSwitchTime.current < 2000) {
      console.log("Video error debounced");
      return;
    }
    
    setVideoErrorCount(prev => {
      const newCount = prev + 1;
      if (newCount > 3) {
        console.warn("Too many video errors, falling back to static background");
        setUseStaticBackground(true);
        return newCount;
      }
      console.log("Switching video due to error");
      changeVideo();
      return newCount;
    });
  };

  const handleVideoLoad = () => {
    setVideoLoaded(true);
  };

  const restartTrack = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      if (!isPlaying) setIsPlaying(true);
    }
  };

  const changeVideo = () => {
    lastVideoSwitchTime.current = Date.now();
    setVideoLoaded(false);
    setUseStaticBackground(false); // Try to recover video if manually switched
    setVideoErrorCount(0); // Reset error count on manual switch
    
    let nextVideo;
    do {
      nextVideo = videoList[Math.floor(Math.random() * videoList.length)];
    } while (nextVideo === videoSrc && videoList.length > 1);
    setVideoSrc(nextVideo);
  };

  const randomizeEffects = () => {
    setEffectSeed(prev => prev + 1);
  };

  const togglePlay = () => setIsPlaying(!isPlaying);
  const toggleMute = () => setIsMuted(!isMuted);

  const getAudioUrl = (track: SpaceTrack) => {
    // Ensure URL is properly encoded
    const encodedFilename = encodeURIComponent(track.filename).replace(/%2F/g, "/");
    return `https://archive.org/download/${track.identifier}/${encodedFilename}`;
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black font-vt323 text-white selection:bg-primary selection:text-white">
      {/* Fallback Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: `url(${FALLBACK_BG})` }}
      />

      {/* Background Video */}
      {!useStaticBackground && (
        <div className={cn(
          "absolute inset-0 overflow-hidden z-1 transition-opacity duration-1000",
          videoLoaded ? "opacity-100" : "opacity-0"
        )}>
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={handleVideoLoad}
            onError={handleVideoError}
            className="h-full w-full object-cover transition-all duration-75 ease-out will-change-transform will-change-filter"
            style={{ transformOrigin: 'center center' }}
          />
        </div>
      )}
      
      {/* CRT Overlay */}
      <div className="crt-overlay absolute inset-0 z-10 opacity-30 pointer-events-none" />
      <div className="scanline z-10 opacity-20 pointer-events-none" />
      
      {/* Top HUD Bar */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 z-50 transition-transform duration-500 ease-in-out",
          showControls ? "translate-y-0" : "-translate-y-full"
        )}
      >
        <div className="bg-black/60 backdrop-blur-md border-b border-white/10 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Left: Track Info */}
          <div className="flex-1 text-center md:text-left min-w-0">
            {currentTrack ? (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                <h1 className="text-2xl md:text-3xl font-bold text-shadow-neon truncate text-primary">
                  {currentTrack.date}
                </h1>
                <div className="flex items-center gap-2 text-sm md:text-base text-cyan-300 font-space truncate opacity-90">
                  <span className="truncate">{currentTrack.venue}</span>
                  <span className="hidden md:inline text-white/40">//</span>
                  <span className="hidden md:inline truncate text-white/60">{currentTrack.location}</span>
                </div>
              </div>
            ) : (
              <div className="text-cyan-300 animate-pulse">INITIALIZING SYSTEM...</div>
            )}
          </div>

          {/* Center: Controls */}
          <div className="flex items-center gap-6">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={restartTrack}
              title="Restart Track"
            >
              <SkipBack className="h-6 w-6" />
            </Button>

            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-12 rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-black transition-all hover:scale-110"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={playNextTrack}
              title="Next Space"
            >
              <SkipForward className="h-6 w-6" />
            </Button>
          </div>

          {/* Right: Volume & Extras */}
          <div className="flex items-center gap-4 flex-1 justify-end min-w-[200px]">
            <div className="flex items-center gap-2 w-32 group">
              <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors">
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <Slider 
                value={[isMuted ? 0 : volume]} 
                max={1} 
                step={0.01} 
                onValueChange={(vals) => {
                  setVolume(vals[0]);
                  if (vals[0] > 0) setIsMuted(false);
                }}
                className="cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
              />
            </div>

            <div className="h-8 w-[1px] bg-white/20 mx-2" />

            <div className="flex items-center gap-2 border-l border-white/10 pl-4 ml-2">
              <div className="flex flex-col items-center">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition-transform"
                  onClick={randomizeEffects}
                  title="Change Visual Effects"
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
                <span className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Change EFX</span>
              </div>

              <div className="flex flex-col items-center px-2 hidden md:flex">
                <div className="w-32 h-9 flex items-center gap-2">
                  <span className="text-[10px] text-white/40">OFF</span>
                  <Slider
                    value={[intensity]}
                    max={1}
                    step={0.05}
                    onValueChange={(val) => setIntensity(val[0])}
                    className="cursor-pointer flex-1"
                  />
                  <span className="text-[10px] text-white/40">MAX</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Intensity</span>
              </div>

              <div className="flex flex-col items-center">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition-transform"
                  onClick={changeVideo}
                  title="Switch Background Video"
                >
                  <Monitor className="h-5 w-5" />
                </Button>
                <span className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Scene</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Credits Line */}
        <div className="bg-black/80 text-[10px] text-center py-1 text-white/30 font-space uppercase tracking-widest">
          Audio: Archive.org (Grateful Dead) // Video: NASA Public Domain // Space Jukebox v4.2.0
        </div>
      </div>

      {/* Hidden Audio Element */}
      {currentTrack && (
        <audio 
          ref={audioRef}
          src={getAudioUrl(currentTrack)}
          onEnded={playNextTrack}
          onError={handleAudioError}
          crossOrigin="anonymous"
        />
      )}
    </div>
  );
}
