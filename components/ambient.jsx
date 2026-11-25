import { useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { FiMinimize2 } from "react-icons/fi";
import { BsPauseFill, BsPlayFill } from "react-icons/bs";
import { TbPlayerTrackNextFilled, TbPlayerTrackPrevFilled } from "react-icons/tb";
import { usePlayer } from "@/store/player";
import { coverUrl, currentPosition, formatTime } from "@/lib/playback";
import useCoverColors from "@/hooks/useCoverColors";
import { activeLine, fetchLyrics, wordEnd } from "@/lib/lyrics";
import { isJapanese, toRomaji } from "@/lib/romaji";

const EASE = [0.22, 1, 0.36, 1];
const IDLE_MS = 3000; // controls and cursor hide after this long without a move

// A slow, endless drift for the background layers (off for reduced motion).
const drift = (reduce, x, y, scale, duration) =>
  reduce
    ? {}
    : {
        animate: { x: [0, x, -x * 0.6, 0], y: [0, -y, y * 0.8, 0], scale: [1, scale, 1.02, 1] },
        transition: { duration, repeat: Infinity, ease: "easeInOut" },
      };

// Synced lyrics for the playing song, with romaji added when the lyrics settings ask for it; null if
// the song has no synced lyrics (plain text can't follow the music, so ambient shows none).
function useAmbientLyrics(track) {
  const uri = track?.uri;
  const script = usePlayer((s) => s.lyricsSettings.script);
  const [state, setState] = useState({ key: null, lines: null });
  const key = uri ? `${uri}|${script}` : null;
  useEffect(() => {
    if (!key) return;
    let alive = true;
    (async () => {
      const data = await fetchLyrics(track).catch(() => null);
      let lines = data?.synced ?? null;
      if (lines && script !== "original" && isJapanese(lines.map((l) => l.text))) {
        try {
          const romaji = await toRomaji(lines.map((l) => l.text));
          const words = await toRomaji(lines.flatMap((l) => (l.words ?? []).map((w) => w.text.trim())));
          let k = 0;
          lines = lines.map((l, i) => ({ ...l, romaji: romaji[i], romajiWords: (l.words ?? []).map(() => words[k++]) }));
        } catch {} // no romaji: the original still shows
      }
      if (alive) setState({ key, lines });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key covers the song and the script
  }, [key]);
  return state.key === key ? state.lines : null;
}

// The previous line, the sung one (large, filling word by word if that's on), and the next two;
// lines glide up as the song moves on.
const AmbientLyrics = ({ lines, position, isPlaying }) => {
  const { script, wordByWord } = usePlayer(useShallow((s) => ({ script: s.lyricsSettings.script, wordByWord: s.lyricsSettings.wordByWord })));
  const active = activeLine(lines, position);
  const shown = [active - 1, active, active + 1, active + 2].filter((i) => i >= 0 && i < lines.length);
  const ref = useRef(null);
  const karaoke = wordByWord && !!lines[active]?.words?.length;

  // Paint the word fill each frame while playing, like the lyrics panel.
  useEffect(() => {
    if (!karaoke) return;
    let raf = 0;
    const paint = () => {
      const pos = currentPosition(usePlayer.getState());
      for (const el of ref.current?.querySelectorAll("[data-ws]") ?? []) {
        const p = Math.max(0, Math.min(1, (pos - Number(el.dataset.ws)) / Math.max(1, Number(el.dataset.we) - Number(el.dataset.ws))));
        el.style.setProperty("--p", `${(p * 112 - 6).toFixed(1)}%`);
      }
      if (usePlayer.getState().isPlaying) raf = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [karaoke, active, isPlaying]);

  const textOf = (l) => (script === "romaji" ? l.romaji ?? l.text : l.text) || "♪";

  return (
    <div ref={ref} className="flex w-full max-w-3xl flex-col gap-5 text-center lg:w-[40vw] lg:text-left">
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((i) => {
          const line = lines[i];
          const current = i === active;
          return (
            <motion.div
              key={`${i}-${line.timeMs}`}
              layout
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: current ? 1 : i < active ? 0.3 : 0.4, y: 0, scale: current ? 1 : 0.94 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{ transformOrigin: "left center" }}
              className={`font-bold leading-tight drop-shadow-lg ${current ? "text-3xl sm:text-4xl lg:text-5xl" : "text-xl sm:text-2xl lg:text-3xl"}`}
            >
              {current && karaoke
                ? line.words.map((w, j) => (
                    <span key={j} data-ws={w.timeMs} data-we={wordEnd(lines, i, j)} className="karaoke-word">
                      {script === "romaji" && line.romajiWords ? `${line.romajiWords[j] ?? w.text}${j < line.words.length - 1 ? " " : ""}` : w.text}
                    </span>
                  ))
                : textOf(line)}
              {script === "both" && line.romaji && line.romaji !== line.text && (
                <span className="mt-1 block text-[0.55em] font-semibold opacity-60">{line.romaji}</span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

const Scene = () => {
  const s = usePlayer(
    useShallow((st) => ({
      track: st.track,
      isPlaying: st.isPlaying,
      positionMs: st.positionMs,
      positionAt: st.positionAt,
      durationMs: st.durationMs,
    }))
  );
  const { togglePlay, next, prev, toggleAmbient } = usePlayer.getState();
  const reduce = useReducedMotion();
  const cover = coverUrl(s.track?.album?.images, 640);
  const { vivid } = useCoverColors(coverUrl(s.track?.album?.images, 64));
  const glow = vivid ?? "rgb(120 120 140)";

  // Progress, 4 ticks a second (the bar's width glides between them).
  const [, tick] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!s.isPlaying) return;
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [s.isPlaying]);
  const position = currentPosition(s);
  const lyrics = useAmbientLyrics(s.track); // synced lines, or null: then nothing is shown
  // Smaller cover beside lyrics; larger and alone without them.
  const coverSize = lyrics ? "w-[min(34vh,60vw)] lg:w-[min(52vh,34vw)]" : "w-[min(56vh,72vw)]";
  const pct = s.durationMs ? Math.min(100, (position / s.durationMs) * 100) : 0;

  // Controls and cursor show on movement and fade after a few quiet seconds.
  const [awake, setAwake] = useState(true);
  const idleTimer = useRef(0);
  const wake = () => {
    setAwake(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setAwake(false), IDLE_MS);
  };
  useEffect(() => {
    idleTimer.current = setTimeout(() => setAwake(false), IDLE_MS);
    return () => clearTimeout(idleTimer.current);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      onPointerMove={wake}
      onPointerDown={wake}
      className={`fixed inset-0 z-[60] overflow-hidden bg-black text-white ${awake ? "" : "cursor-none"}`}
      role="dialog"
      aria-label="Ambient mode"
    >
      {/* Living background: the cover, huge and blurred, drifting; two blobs of its colour floating
          over it; a vignette to keep the text readable. */}
      <AnimatePresence>
        {cover && (
          <motion.div
            key={cover}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: EASE }}
            className="absolute -inset-[20%]"
          >
            <motion.div
              {...drift(reduce, 60, 40, 1.12, 38)}
              className="cover-glow h-full w-full bg-cover bg-center blur-[90px] saturate-150"
              style={{ backgroundImage: `url(${cover})` }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        {...drift(reduce, 140, 90, 1.25, 26)}
        className="absolute left-[10%] top-[15%] h-[55vmax] w-[55vmax] rounded-full opacity-40 mix-blend-screen transition-[background] duration-[2000ms]"
        style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 65%)` }}
      />
      <motion.div
        {...drift(reduce, -120, 110, 1.18, 33)}
        className="absolute bottom-[5%] right-[5%] h-[45vmax] w-[45vmax] rounded-full opacity-30 mix-blend-screen transition-[background] duration-[2000ms]"
        style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 60%)` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.65)_100%)]" />

      {/* With synced lyrics: cover and title on one side, the lines on the other (stacked on narrow
          screens). Without: the cover alone, centred. */}
      <div
        className={`relative flex h-full items-center justify-center px-[6vw] ${
          lyrics ? "flex-col gap-8 lg:flex-row lg:gap-[6vw]" : "flex-col gap-8"
        }`}
      >
        <div className="flex shrink-0 flex-col items-center gap-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={s.track?.uri ?? "none"}
              initial={{ opacity: 0, scale: 0.94, filter: "blur(12px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.03, filter: "blur(12px)" }}
              transition={{ duration: 0.9, ease: EASE }}
              className="flex flex-col items-center gap-8"
            >
              <div
                className={`relative aspect-square overflow-hidden rounded-[28px] bg-white/5 shadow-[0_40px_120px_rgba(0,0,0,0.6)] ring-1 ring-white/10 ${coverSize}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Spotify CDN, 640px */}
                {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className={`text-center ${lyrics ? "max-w-[min(52vh,80vw)] lg:max-w-[34vw]" : "max-w-[80vw]"}`}>
                <h2 className={`line-clamp-2 font-bold leading-tight drop-shadow-lg ${lyrics ? "text-2xl sm:text-4xl" : "text-3xl sm:text-5xl"}`}>
                  {s.track?.name ?? "Nothing playing"}
                </h2>
                <p className="mt-3 truncate text-lg text-white/70 sm:text-2xl">{s.track?.artists?.map((a) => a.name).join(", ")}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className={coverSize}>
            <div className="h-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white/80 transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs tabular-nums text-white/50">
              <span>{formatTime(position)}</span>
              <span>{formatTime(s.durationMs)}</span>
            </div>
          </div>
        </div>

        {lyrics && <AmbientLyrics lines={lyrics} position={position} isPlaying={s.isPlaying} />}
      </div>

      {/* Controls: appear with the cursor, fade when it rests. */}
      <motion.div
        animate={{ opacity: awake ? 1 : 0, y: awake ? 0 : 12 }}
        transition={{ duration: 0.4, ease: EASE }}
        className={`absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-4 ${awake ? "" : "pointer-events-none"}`}
      >
        <button onClick={prev} aria-label="Previous" className="rounded-full p-3 text-white/80 hover:bg-white/10 hover:text-white">
          <TbPlayerTrackPrevFilled className="h-6 w-6" />
        </button>
        <button
          onClick={togglePlay}
          aria-label={s.isPlaying ? "Pause" : "Play"}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
        >
          {s.isPlaying ? <BsPauseFill className="h-7 w-7" /> : <BsPlayFill className="ml-1 h-7 w-7" />}
        </button>
        <button onClick={next} aria-label="Next" className="rounded-full p-3 text-white/80 hover:bg-white/10 hover:text-white">
          <TbPlayerTrackNextFilled className="h-6 w-6" />
        </button>
      </motion.div>
      <motion.button
        animate={{ opacity: awake ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        onClick={toggleAmbient}
        aria-label="Exit ambient mode"
        title="Exit (Esc)"
        className={`absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] rounded-full bg-black/30 p-2.5 text-white/80 ring-1 ring-white/10 backdrop-blur hover:text-white ${awake ? "" : "pointer-events-none"}`}
      >
        <FiMinimize2 className="h-5 w-5" />
      </motion.button>
    </motion.div>
  );
};

// Full-screen ambient mode: for a second screen or a TV. Enters browser fullscreen too; leaving
// fullscreen (Esc) leaves the mode.
export default function Ambient() {
  const open = usePlayer((s) => s.ambientOpen);

  useEffect(() => {
    if (!open) return;
    document.documentElement.requestFullscreen?.().catch(() => {}); // refused: still fills the window
    const onFullscreen = () => !document.fullscreenElement && usePlayer.setState({ ambientOpen: false });
    const onKey = (e) => e.key === "Escape" && usePlayer.setState({ ambientOpen: false });
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [open]);

  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>{open && <Scene />}</AnimatePresence>, document.body);
}
