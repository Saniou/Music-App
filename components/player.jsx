import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRecoilState } from "recoil";
import { debounce } from "lodash";
import {
  AiOutlinePlayCircle,
  AiOutlinePauseCircle,
} from "react-icons/ai";
import { BsArrowLeftRight, BsVolumeMute, BsFillVolumeUpFill } from "react-icons/bs";
import {
  TbPlayerTrackPrevFilled,
  TbPlayerTrackNextFilled,
} from "react-icons/tb";
import { TbRepeat, TbRepeatOnce } from "react-icons/tb";
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

  // Read the current playback state from Spotify and sync local UI to it.
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

  // Initial fetch once a token is available.
  useEffect(() => {
    if (spotifyApi.getAccessToken()) {
      syncPlaybackState();
    }
  }, [spotifyApi, syncPlaybackState]);

  // Advance the progress bar locally while playing, re-syncing periodically.
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
    if (volume >= 0 && volume <= 100) {
      debouncedSetVolume(volume);
    }
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
    const next = REPEAT_MODES[(REPEAT_MODES.indexOf(repeatMode) + 1) % REPEAT_MODES.length];
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

  return (
    <div className="text-white h-24 bg-gradient-to-b from-[#161618] to-black grid grid-cols-3 items-center text-xs md:text-base px-2 md:px-4">
      {/* Track info */}
      <div className="flex items-center space-x-4">
        {albumImage && (
          <Image
            className="hidden md:inline h-10 w-10 rounded"
            src={albumImage}
            width={40}
            height={40}
            alt={songInfo?.name ?? "Album art"}
          />
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{songInfo?.name ?? "—"}</h3>
          <p className="truncate text-xs text-gray-400">
            {songInfo?.artists?.map((a) => a.name).join(", ")}
          </p>
        </div>
      </div>

      {/* Controls + progress */}
      <div className="flex flex-col items-center justify-center gap-1">
        <div className="flex items-center justify-evenly gap-4">
          <button onClick={handleShuffle} aria-label="Shuffle">
            <BsArrowLeftRight className={`button ${isShuffle ? "text-green-500" : ""}`} />
          </button>
          <button onClick={handlePrev} aria-label="Previous">
            <TbPlayerTrackPrevFilled className="button" />
          </button>
          <button onClick={handlePlayPause} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? (
              <AiOutlinePauseCircle className="h-8 w-8 button" />
            ) : (
              <AiOutlinePlayCircle className="h-8 w-8 button" />
            )}
          </button>
          <button onClick={handleNext} aria-label="Next">
            <TbPlayerTrackNextFilled className="button" />
          </button>
          <button onClick={handleRepeat} aria-label="Repeat">
            {repeatMode === "track" ? (
              <TbRepeatOnce className="button text-green-500" />
            ) : (
              <TbRepeat className={`button ${repeatMode === "context" ? "text-green-500" : ""}`} />
            )}
          </button>
        </div>

        <div className="hidden md:flex w-full max-w-md items-center gap-2">
          <span className="w-10 text-right text-[10px] text-gray-400">
            {formatDuration(progressMs)}
          </span>
          <input
            className="w-full accent-green-500"
            type="range"
            min={0}
            max={durationMs || 0}
            step={1000}
            value={Math.min(progressMs, durationMs || 0)}
            onChange={(event) => handleSeek(Number(event.target.value))}
            disabled={!durationMs}
          />
          <span className="w-10 text-[10px] text-gray-400">
            {formatDuration(durationMs)}
          </span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center justify-end space-x-3 md:space-x-4 pr-2 md:pr-5">
        <button onClick={() => setVolume(0)} aria-label="Mute">
          <BsVolumeMute className="button" />
        </button>
        <input
          className="w-14 md:w-28 accent-green-500"
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
        <button
          onClick={() => setVolume((v) => Math.min(v + 5, 100))}
          aria-label="Volume up"
        >
          <BsFillVolumeUpFill className="button" />
        </button>
      </div>
    </div>
  );
};

export default Player;
