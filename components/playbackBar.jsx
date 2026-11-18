import { useEffect, useReducer, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { BsRepeat, BsRepeat1, BsShuffle, BsVolumeMuteFill, BsVolumeUpFill } from "react-icons/bs";
import { usePlayer } from "@/store/player";
import { currentPosition, formatTime } from "@/lib/playback";

// React's onChange is the live `input` event; the native `change` fires once on release
// (mouse, touch or keyboard), which is when we tell Spotify.
const Slider = ({ value, max, step, label, disabled, onDrag, onCommit, className = "" }) => {
  const ref = useRef(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => {
    const el = ref.current;
    const onChange = () => commit.current(Number(el.value));
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, []);
  return (
    <input
      ref={ref}
      type="range"
      min={0}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onDrag(Number(e.target.value))}
      style={{ "--pct": `${max ? (value / max) * 100 : 0}%` }}
      className={`range ${className}`}
    />
  );
};

const PlaybackBar = () => {
  const s = usePlayer(
    useShallow((st) => ({
      hasTrack: !!st.track,
      isPlaying: st.isPlaying,
      positionMs: st.positionMs,
      positionAt: st.positionAt,
      durationMs: st.durationMs,
      volume: st.volume,
      shuffle: st.shuffle,
      repeat: st.repeat,
    }))
  );
  const { seek, setVolume, toggleShuffle, cycleRepeat } = usePlayer.getState();

  // Re-render twice a second while playing; the position itself is extrapolated, not polled.
  const [, tick] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!s.isPlaying) return;
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [s.isPlaying]);

  const [dragPos, setDragPos] = useState(null);
  const [dragVol, setDragVol] = useState(null);
  const position = dragPos ?? currentPosition(s);
  const volume = dragVol ?? s.volume;
  const RepeatIcon = s.repeat === "track" ? BsRepeat1 : BsRepeat;
  const VolumeIcon = volume === 0 ? BsVolumeMuteFill : BsVolumeUpFill;

  return (
    <div className="mt-6 w-full">
      <div className="flex items-center gap-3 text-xs tabular-nums text-gray-400">
        <span className="w-10 text-right">{formatTime(position)}</span>
        <Slider
          className="flex-1"
          label="Seek"
          value={Math.min(position, s.durationMs || 0)}
          max={s.durationMs || 1}
          step={1000}
          disabled={!s.hasTrack}
          onDrag={setDragPos}
          onCommit={(ms) => {
            seek(ms);
            setDragPos(null);
          }}
        />
        <span className="w-10">{formatTime(s.durationMs)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between text-gray-400">
        <div className="flex items-center gap-1">
          <button
            onClick={toggleShuffle}
            aria-label="Shuffle"
            aria-pressed={s.shuffle}
            className={`p-2 transition-colors duration-200 hover:text-white ${s.shuffle ? "text-spotify" : ""}`}
          >
            <BsShuffle className="h-4 w-4" />
          </button>
          <button
            onClick={cycleRepeat}
            aria-label={`Repeat: ${s.repeat}`}
            className={`p-2 transition-colors duration-200 hover:text-white ${s.repeat !== "off" ? "text-spotify" : ""}`}
          >
            <RepeatIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <VolumeIcon className="h-4 w-4" aria-hidden />
          <Slider
            className="w-24"
            label="Volume"
            value={volume}
            max={1}
            step={0.01}
            onDrag={setDragVol}
            onCommit={(v) => {
              setVolume(v);
              setDragVol(null);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PlaybackBar;
