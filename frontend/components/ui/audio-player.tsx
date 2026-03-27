"use client";

import { Play, Pause, Download, Volume2, VolumeX, Gauge } from "lucide-react";
import { useRef, useState, useEffect, useMemo } from "react";
import { Card } from "./card";
import { Button } from "./button";

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  className?: string;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function AudioPlayer({ audioUrl, title = "Podcast Audio", className = "" }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const timeUpdateRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      const now = performance.now();
      if (now - timeUpdateRef.current < 125) {
        return;
      }
      timeUpdateRef.current = now;
      setCurrentTime(audio.currentTime);
    };
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = speed;
    setPlaybackRate(speed);
    setShowSpeedMenu(false);
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const downloadAudio = () => {
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `${title}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const waveformBars = useMemo(
    () =>
      Array.from({ length: 100 }, (_, i) => {
        const baseHeight = 15 + Math.sin(i * 0.2) * 25 + Math.cos(i * 0.4) * 15;
        const randomVariation = Math.sin(i * 0.7) * 10;
        return {
          id: i,
          barProgress: (i / 100) * 100,
          height: baseHeight + randomVariation,
          delay: `${i * 0.02}s`,
        };
      }),
    []
  );

  return (
    <Card className={`${className} overflow-hidden relative bg-[var(--bg-primary)]`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="relative z-10 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-1.5">
              <div className="p-1.5 bg-gradient-to-br from-brand-500 to-accent-500 rounded-lg">
                <Volume2 className="w-4 h-4 text-white" />
              </div>
              {title}
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[var(--text-tertiary)]">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <span className="px-2 py-0.5 bg-accent-50 text-accent-700 font-semibold rounded-md">
                {playbackRate}x
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={downloadAudio}
            className="!p-2 hover:bg-[var(--bg-tertiary)] transition-colors"
            aria-label="Download audio"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>

        {/* Waveform Progress Visualization */}
        <div className="space-y-2">
          <div className="relative h-24 rounded-2xl bg-gradient-to-r from-[var(--bg-secondary)] via-[var(--bg-tertiary)] to-[var(--bg-secondary)] overflow-hidden border border-[var(--border-light)]">
            {/* Progress Overlay */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500/20 via-accent-500/20 to-brand-500/20 backdrop-blur-[1px] transition-all duration-100 border-r-2 border-brand-400"
              style={{ width: `${progress}%` }}
            />

            {/* Wave Bars */}
            <div className="absolute inset-0 flex items-center justify-center gap-[3px] px-3">
              {waveformBars.map((bar) => {
                const isPassed = bar.barProgress <= progress;

                return (
                  <div
                    key={bar.id}
                    className={`flex-shrink-0 rounded-full transition-all duration-200 ${
                      isPlaying && isPassed ? "animate-pulse-wave" : ""
                    }`}
                    style={{
                      height: `${bar.height}%`,
                      backgroundColor: isPassed
                        ? bar.id % 2 === 0
                          ? "rgba(99, 102, 241, 0.7)"
                          : "rgba(168, 85, 247, 0.7)"
                        : "rgba(148, 163, 184, 0.3)",
                      width: "2px",
                      animationDelay: bar.delay,
                    }}
                  />
                );
              })}
            </div>

            {/* Seek Input Overlay */}
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              aria-label="Seek audio"
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Play/Pause Button */}
          <Button
            onClick={togglePlayPause}
            className="!w-14 !h-14 !rounded-full bg-gradient-to-br from-brand-500 via-brand-600 to-accent-600 hover:from-brand-600 hover:via-brand-700 hover:to-accent-700 text-white !p-0 flex items-center justify-center shadow-xl shadow-brand-500/40 transition-all hover:scale-105 active:scale-95"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" fill="currentColor" />
            ) : (
              <Play className="w-6 h-6 ml-1" fill="currentColor" />
            )}
          </Button>

          {/* Speed Control */}
          <div className="relative">
            <Button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              variant="ghost"
              className="!h-11 !px-3 gap-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-light)] transition-all hover:border-brand-300"
            >
              <Gauge className="w-4 h-4 text-accent-500" />
              <span className="text-sm font-semibold">{playbackRate}x</span>
            </Button>

            {showSpeedMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowSpeedMenu(false)}
                />
                <div className="absolute bottom-full left-0 mb-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-xl shadow-2xl overflow-hidden z-30 min-w-[140px]">
                  <div className="p-2 bg-[var(--bg-secondary)] border-b border-[var(--border-light)]">
                    <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
                      Playback Speed
                    </span>
                  </div>
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => changePlaybackSpeed(speed)}
                      className={`w-full px-4 py-2.5 text-sm text-left hover:bg-[var(--bg-secondary)] transition-colors ${
                        speed === playbackRate
                          ? "bg-gradient-to-r from-brand-50 to-accent-50 text-brand-700 font-bold border-l-4 border-brand-500"
                          : "text-[var(--text-secondary)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{speed}x</span>
                        {speed === 1 && (
                          <span className="text-xs text-[var(--text-tertiary)]">Normal</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2.5 flex-1">
            <button
              onClick={toggleMute}
              className="text-[var(--text-tertiary)] hover:text-brand-500 transition-colors p-2 hover:bg-[var(--bg-secondary)] rounded-lg"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <div className="relative flex-1 max-w-[140px] h-2">
              <div className="absolute inset-0 bg-[var(--bg-tertiary)] rounded-full" />
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-400 to-accent-600 rounded-full transition-all"
                style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="absolute inset-0 w-full h-full appearance-none cursor-pointer bg-transparent
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-white
                  [&::-webkit-slider-thumb]:border-2
                  [&::-webkit-slider-thumb]:border-accent-500
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:shadow-lg
                  [&::-webkit-slider-thumb]:transition-transform
                  [&::-webkit-slider-thumb]:hover:scale-125"
                aria-label="Volume control"
              />
            </div>
            <span className="text-xs font-medium text-[var(--text-tertiary)] w-8 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-wave {
          0%, 100% {
            opacity: 0.7;
            transform: scaleY(1);
          }
          50% {
            opacity: 1;
            transform: scaleY(1.1);
          }
        }
        .animate-pulse-wave {
          animation: pulse-wave 0.8s ease-in-out infinite;
        }
      `}</style>
    </Card>
  );
}
