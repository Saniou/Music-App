import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRecoilState } from "recoil";
import { debounce } from "lodash";
import { BsShuffle, BsPlayCircleFill, BsPauseCircleFill } from "react-icons/bs";
import {
  TbPlayerTrackPrevFilled,
  TbPlayerTrackNextFilled,
  TbRepeat,
  TbRepeatOnce,
} from "react-icons/tb";
import { FiVolume2, FiVolumeX } from "react-icons/fi";
import useSpotify from "@/hooks/useSpotify";
import useSongInfo from "@/hooks/useSongInfo";
import { formatDuration } from "@/lib/duration";
import { currentTrackIdState, isPlayingState } from "@/atoms/songAtom";

const REPEAT_MODES = ["off", "context", "track"];

const Player = () => {
  const spotifyApi = useSpotify();
  const songInfo = useSongInfo();

  const [currentTrackId, setCurrentTrackId] = useRecoilState(currentTrackIdState);
  const [isPlaying, setIsPlaying] = useRecoilState(isPlayingState);

  const [volume, setVolume] = useState(50);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");
  const [progressMs, setProgressMs] = useState(0);

  const durationMs = songInfo?.duration_ms ?? 0;

  const syncPlaybackState = useCallback(async () => {
    try {
      const { body } = await spotifyApi.getMyCurrentPlaybackState();
      if (!body) return;
      if (body.item?.id) setCurrentTrackId(body.item.id);
      setIsPlaying(Boolean(body.is_playing));
      setProgressMs(body.progress_ms ?? 0);
      setIsShuffle(Boolean(body.shuffle_state));
      setRepeatMode(body.repeat_state ?? "off");
      if (typeof body.device?.volume_percent === "number") {
        setVolume(body.device.volume_percent);
      }
    } catch (error) {
      // Usually "no active device" — safe to ignore for the UI.
    }
  }, [spotifyApi, setCurrentTrackId, setIsPlaying]);

  useEffect(() => {
    if (spotifyApi.getAccessToken()) syncPlaybackState();
  }, [spotifyApi, syncPlaybackState]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const tick = setInterval(() => {
      setProgressMs((prev) => Math.min(prev + 1000, durationMs || prev + 1000));
    }, 1000);
    const resync = setInterval(syncPlaybackState, 8000);
    return () => {
      clearInterval(tick);
      clearInterval(resync);
    };
  }, [isPlaying, durationMs, syncPlaybackState]);

  const debouncedSetVolume = useMemo(
    () =>
      debounce((value) => {
        spotifyApi.setVolume(value).catch(() => {});
      }, 400),
    [spotifyApi]
  );

  useEffect(() => {
    if (volume >= 0 && volume <= 100) debouncedSetVolume(volume);
  }, [volume, debouncedSetVolume]);

  const handlePlayPause = async () => {
    try {
      const { body } = await spotifyApi.getMyCurrentPlaybackState();
      if (body?.is_playing) {
        await spotifyApi.pause();
        setIsPlaying(false);
      } else {
        await spotifyApi.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Play/pause failed", error);
    }
  };

  const handleNext = async () => {
    try {
      await spotifyApi.skipToNext();
      setTimeout(syncPlaybackState, 500);
    } catch (error) {
      console.error("Skip to next failed", error);
    }
  };

  const handlePrev = async () => {
    try {
      await spotifyApi.skipToPrevious();
      setTimeout(syncPlaybackState, 500);
    } catch (error) {
      console.error("Skip to previous failed", error);
    }
  };

  const handleShuffle = async () => {
    const next = !isShuffle;
    setIsShuffle(next);
    try {
      await spotifyApi.setShuffle(next);
    } catch (error) {
      setIsShuffle(!next);
    }
  };

  const handleRepeat = async () => {
    const next =
      REPEAT_MODES[(REPEAT_MODES.indexOf(repeatMode) + 1) % REPEAT_MODES.length];
    setRepeatMode(next);
    try {
      await spotifyApi.setRepeat(next);
    } catch (error) {
      setRepeatMode(repeatMode);
    }
  };

  const handleSeek = async (value) => {
    setProgressMs(value);
    try {
      await spotifyApi.seek(value);
    } catch (error) {
      console.error("Seek failed", error);
    }
  };

  const albumImage = songInfo?.album?.images?.[0]?.url;
  const isMuted = volume === 0;

  return (
    <footer className="grid h-20 grid-cols-3 items-center gap-2 border-t border-white/10 bg-panel px-3 md:px-6">
      {/* Track info */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative hidden h-14 w-14 flex-shrink-0 overflow-hidden rounded bg-elevated md:block">
          {albumImage && (
            <Image src={albumImage} width={56} height={56} alt={songInfo?.name ?? "Album art"} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-white">
            {songInfo?.name ?? "—"}
          </h3>
          <p className="truncate text-xs text-gray-400">
            {songInfo?.artists?.map((a) => a.name).join(", ")}
          </p>
        </div>
      </div>

      {/* Controls + progress */}
      <div className="flex flex-col items-center justify-center gap-1.5">
        <div className="flex items-center gap-5">
          <button onClick={handleShuffle} aria-label="Shuffle" className="icon-btn">
            <BsShuffle className={`h-4 w-4 ${isShuffle ? "text-spotify" : ""}`} />
          </button>
          <button onClick={handlePrev} aria-label="Previous" className="icon-btn">
            <TbPlayerTrackPrevFilled className="h-5 w-5" />
          </button>
          <button
            onClick={handlePlayPause}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="text-white transition-transform duration-200 hover:scale-105"
          >
            {isPlaying ? (
              <BsPauseCircleFill className="h-9 w-9" />
            ) : (
              <BsPlayCircleFill className="h-9 w-9" />
            )}
          </button>
          <button onClick={handleNext} aria-label="Next" className="icon-btn">
            <TbPlayerTrackNextFilled className="h-5 w-5" />
          </button>
          <button onClick={handleRepeat} aria-label="Repeat" className="icon-btn">
            {repeatMode === "track" ? (
              <TbRepeatOnce className="h-4 w-4 text-spotify" />
            ) : (
              <TbRepeat className={`h-4 w-4 ${repeatMode === "context" ? "text-spotify" : ""}`} />
            )}
          </button>
        </div>

        <div className="hidden w-full max-w-md items-center gap-2 md:flex">
          <span className="w-9 text-right text-[10px] tabular-nums text-gray-400">
            {formatDuration(progressMs)}
          </span>
          <input
            className="h-1 w-full cursor-pointer accent-spotify"
            type="range"
            min={0}
            max={durationMs || 0}
            step={1000}
            value={Math.min(progressMs, durationMs || 0)}
            onChange={(event) => handleSeek(Number(event.target.value))}
            disabled={!durationMs}
            aria-label="Seek"
          />
          <span className="w-9 text-[10px] tabular-nums text-gray-400">
            {formatDuration(durationMs)}
          </span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center justify-end gap-2 md:gap-3">
        <button
          onClick={() => setVolume(isMuted ? 40 : 0)}
          aria-label={isMuted ? "Unmute" : "Mute"}
          className="icon-btn"
        >
          {isMuted ? <FiVolumeX className="h-5 w-5" /> : <FiVolume2 className="h-5 w-5" />}
        </button>
        <input
          className="h-1 w-16 cursor-pointer accent-spotify md:w-28"
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          aria-label="Volume"
        />
      </div>
    </footer>
  );
};

export default Player;
