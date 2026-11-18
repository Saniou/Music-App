import { useEffect, useReducer } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { BsHeart, BsHeartFill, BsPauseFill, BsPlayFill } from "react-icons/bs";
import { TbPlayerTrackNextFilled, TbPlayerTrackPrevFilled } from "react-icons/tb";
import { usePlayer } from "@/store/player";
import { coverUrl, currentPosition, formatTime } from "@/lib/playback";

const Mini = ({ win }) => {
  const s = usePlayer(
    useShallow((st) => ({
      track: st.track,
      isPlaying: st.isPlaying,
      positionMs: st.positionMs,
      positionAt: st.positionAt,
      durationMs: st.durationMs,
      liked: !!st.liked[st.track?.uri],
    }))
  );
  const { togglePlay, next, prev, toggleLike } = usePlayer.getState();

  const [, tick] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!s.isPlaying) return;
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [s.isPlaying]);

  // Keys work while this little window has focus too.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    win.document.addEventListener("keydown", onKey);
    return () => win.document.removeEventListener("keydown", onKey);
  }, [win, togglePlay, next, prev]);

  const { track } = s;
  const cover = coverUrl(track?.album?.images, 300);
  const position = currentPosition(s); // our clock, re-read each tick
  const pct = s.durationMs ? Math.min(100, (position / s.durationMs) * 100) : 0;

  return (
    <div className="fixed inset-0 flex select-none flex-col overflow-hidden bg-base p-4 font-sans text-white">
      {cover && (
        <div
          className="pointer-events-none absolute inset-0 scale-125 bg-cover bg-center opacity-40 blur-3xl saturate-150"
          style={{ backgroundImage: `url(${cover})` }}
        />
      )}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="relative aspect-square h-full max-h-full overflow-hidden rounded-2xl bg-white/5 shadow-2xl ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image's loader isn't in the pop-out window */}
          {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
        </div>
      </div>
      <div className="relative mt-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{track?.name ?? "Nothing playing"}</p>
          <p className="truncate text-xs text-gray-300">{track?.artists?.map((a) => a.name).join(", ")}</p>
        </div>
        {track && (
          <button
            onClick={() => toggleLike(track)}
            aria-label={s.liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
            className={`mt-0.5 ${s.liked ? "text-spotify" : "text-gray-300 hover:text-white"}`}
          >
            {s.liked ? <BsHeartFill className="h-4 w-4" /> : <BsHeart className="h-4 w-4" />}
          </button>
        )}
      </div>
      <div className="relative mt-2">
        <div className="h-1 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-gray-400">
          <span>{formatTime(position)}</span>
          <span>{formatTime(s.durationMs)}</span>
        </div>
      </div>
      <div className="relative mt-1 flex items-center justify-center gap-4">
        <button onClick={prev} aria-label="Previous" className="p-2 text-gray-200 hover:text-white">
          <TbPlayerTrackPrevFilled className="h-5 w-5" />
        </button>
        <button
          onClick={togglePlay}
          aria-label={s.isPlaying ? "Pause" : "Play"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
        >
          {s.isPlaying ? <BsPauseFill className="h-6 w-6" /> : <BsPlayFill className="ml-0.5 h-6 w-6" />}
        </button>
        <button onClick={next} aria-label="Next" className="p-2 text-gray-200 hover:text-white">
          <TbPlayerTrackNextFilled className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

// The mini player lives in the Picture-in-Picture window but in this React tree, so it shares the
// store: same track, same controls, no syncing.
export default function PipPlayer() {
  const win = usePlayer((s) => s.pipWindow);
  if (!win) return null;
  return createPortal(<Mini win={win} />, win.document.body);
}
