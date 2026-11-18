import { useEffect, useReducer, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  BsLaptop,
  BsPhone,
  BsRepeat,
  BsRepeat1,
  BsShuffle,
  BsSpeaker,
  BsVolumeMuteFill,
  BsVolumeUpFill,
} from "react-icons/bs";
import { TbMicrophone2 } from "react-icons/tb";
import { usePlayer } from "@/store/player";
import { apiGet } from "@/lib/api";
import { currentPosition, explainError, formatTime } from "@/lib/playback";

// Moving the slider shows the value (onDrag); letting go sends it, exactly once (onCommit).
// Both are wired to the native `input` event (onInput) and our own release detection, never to
// `change`: React's onChange also fires on the native `change` that follows a release, which
// re-armed a drag after the commit, froze the bar, and on blur sent a second seek that jumped the
// song back. And Chrome skips `change` when the value equals the one at the previous `change`.
const Slider = ({ value, max, step, label, disabled, onDrag, onCommit, className = "" }) => {
  const pending = useRef(null); // moved-to value not yet sent
  const pointerDown = useRef(false);
  const send = () => {
    if (pending.current === null) return;
    const v = pending.current;
    pending.current = null;
    onCommit(v);
  };
  return (
    <input
      type="range"
      min={0}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={label}
      onInput={(e) => {
        pending.current = Number(e.currentTarget.value);
        onDrag(pending.current);
      }}
      onChange={() => {}} // controlled input; all handling is in onInput
      // Capture so the release lands here even if the pointer leaves the slider mid-drag.
      onPointerDown={(e) => {
        pointerDown.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={() => {
        pointerDown.current = false;
        send();
      }}
      onPointerCancel={() => {
        pointerDown.current = false;
        send();
      }}
      // Keyboard (arrows / Home / End / PageUp / PageDown) sends on key release.
      onKeyUp={() => !pointerDown.current && send()}
      onBlur={() => !pointerDown.current && send()}
      style={{ "--pct": `${max ? (value / max) * 100 : 0}%` }}
      className={`range ${className}`}
    />
  );
};

const DEVICE_ICONS = { Computer: BsLaptop, Smartphone: BsPhone, Speaker: BsSpeaker };

// Where Spotify plays: this tab, the phone, a speaker... Picking one moves playback there.
const DevicePicker = () => {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState(null); // null: loading
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const { transferTo } = usePlayer.getState();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    apiGet("/me/player/devices").then(
      (d) => alive && setDevices(d?.devices ?? []),
      (e) => alive && setError(e)
    );
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setDevices(null);
          setError(null);
          setOpen((v) => !v);
        }}
        aria-label="Choose a device"
        aria-expanded={open}
        title="Devices"
        className="p-2 transition-colors duration-200 hover:text-white"
      >
        <BsSpeaker className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-2 w-64 rounded-xl bg-elevated p-2 text-sm shadow-2xl ring-1 ring-white/10">
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Play on</p>
          {error ? (
            <p className="px-2 py-2 text-gray-400">{explainError(error)}</p>
          ) : !devices ? (
            <p className="px-2 py-2 text-gray-500">Looking for devices…</p>
          ) : !devices.length ? (
            <p className="px-2 py-2 text-gray-500">No devices. Open Spotify on your phone or computer.</p>
          ) : (
            devices.map((d) => {
              const Icon = DEVICE_ICONS[d.type] ?? BsSpeaker;
              return (
                <button
                  key={d.id}
                  disabled={d.is_restricted || !d.id}
                  onClick={() => {
                    transferTo(d.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-hover disabled:opacity-40 ${
                    d.is_active ? "text-spotify" : "text-gray-200"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{d.name}</span>
                  {d.is_active && <span className="text-xs">playing</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
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
  const { seek, setVolume, toggleShuffle, cycleRepeat, toggleLyrics } = usePlayer.getState();
  const lyricsOpen = usePlayer((st) => st.lyricsOpen);

  // Re-render 4x a second while playing (CSS glides the fill in between); the position is our own
  // clock, not polled.
  const [, tick] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!s.isPlaying) return;
    const id = setInterval(tick, 250);
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
          step={250}
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
          <button
            onClick={toggleLyrics}
            aria-label="Lyrics"
            aria-pressed={lyricsOpen}
            title="Lyrics (L)"
            className={`p-2 transition-colors duration-200 hover:text-white ${lyricsOpen ? "text-spotify" : ""}`}
          >
            <TbMicrophone2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <DevicePicker />
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
