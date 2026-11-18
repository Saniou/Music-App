import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { FiX } from "react-icons/fi";
import { BsPauseFill, BsPlayFill } from "react-icons/bs";
import { usePlayer } from "@/store/player";
import { currentPosition } from "@/lib/playback";
import { activeLine, fetchLyrics, wordEnd } from "@/lib/lyrics";

const MANUAL_SCROLL_PAUSE_MS = 4000; // after the user scrolls, don't yank the view back right away
const EASE = [0.22, 1, 0.36, 1];

// Desktop layout numbers, in px so they can be animated: { wide, panel, gap }.
function usePanelSize() {
  const [size, setSize] = useState({ wide: false, panel: 0, gap: 0 });
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setSize({ wide: w >= 1024, panel: Math.round(Math.min(440, w * 0.34)), gap: w >= 1280 ? 64 : 32 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

function useLyrics(track) {
  const [state, setState] = useState({ uri: null, data: null, error: null });
  const uri = track?.uri;
  useEffect(() => {
    if (!uri) return;
    let alive = true;
    fetchLyrics(track).then(
      (data) => alive && setState({ uri, data, error: null }),
      (error) => alive && setState({ uri, data: null, error })
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new object for the same song isn't a new song
  }, [uri]);
  const fresh = state.uri === uri;
  return { data: fresh ? state.data : null, error: fresh ? state.error : null, loading: !!uri && !fresh };
}

// A gently convex surface: the line at the box's center is full size and sharp; towards the edges
// lines shrink, fade and soften, so scrolling feels like rolling a ball. No rotation: per-line 3D tilt
// turned lines into skewed trapezoids. Written straight to the DOM on scroll, not through React state.
function bendLines(box) {
  const half = box.clientHeight / 2;
  const mid = box.scrollTop + half;
  for (const el of box.querySelectorAll("[data-line]")) {
    const d = Math.min(1, Math.abs(el.offsetTop + el.offsetHeight / 2 - mid) / half); // 0 center .. 1 edge
    const k = d ** 1.5;
    el.style.transform = `scale(${1 - 0.22 * k})`;
    el.style.opacity = String(1 - 0.85 * k);
    el.style.filter = d > 0.35 ? `blur(${((d - 0.35) * 3).toFixed(1)}px)` : "";
  }
}

const LyricsBody = ({ track, wide }) => {
  const { data, error, loading } = useLyrics(track);
  const clock = usePlayer(
    useShallow((s) => ({
      uri: s.track?.uri,
      isPlaying: s.isPlaying,
      positionMs: s.positionMs,
      positionAt: s.positionAt,
      durationMs: s.durationMs,
    }))
  );
  const { seek } = usePlayer.getState();
  const playingThis = clock.uri === track?.uri;

  // 4 ticks a second while playing, same clock as the progress bar.
  const [, tick] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    if (!clock.isPlaying) return;
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [clock.isPlaying]);

  const lines = data?.synced;
  const active = lines && playingThis ? activeLine(lines, currentPosition(clock)) : -1;

  const boxRef = useRef(null);
  const manualAt = useRef(0);
  const frame = useRef(0);

  // Bend once the lines are laid out, and again on resize; scrolling re-bends per frame (onScroll).
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    bendLines(box);
    const onResize = () => bendLines(box);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame.current);
    };
  }, [data, wide]);

  const onScroll = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (boxRef.current) bendLines(boxRef.current);
    });
  };

  // Roll the sung line (before the first one: the first line) to the center, unless the user just
  // scrolled to read ahead. Runs when the lyrics arrive too, jumping straight there; later lines glide.
  // scrollTo on the box, not scrollIntoView, which would also scroll the page.
  const placed = useRef(null); // the lyrics we've already positioned for
  useEffect(() => {
    const box = boxRef.current;
    const el = box?.querySelector(`[data-line="${Math.max(0, active)}"]`);
    if (!el) return;
    const first = placed.current !== data;
    if (!first && Date.now() - manualAt.current < MANUAL_SCROLL_PAUSE_MS) return;
    placed.current = data;
    box.scrollTo({ top: el.offsetTop + el.offsetHeight / 2 - box.clientHeight / 2, behavior: first ? "auto" : "smooth" });
  }, [active, data]);

  // Word-by-word fill of the sung line, every animation frame while playing (once when paused or
  // after a seek). Straight to the DOM: 60 React renders a second for this would be wasteful.
  const activeHasWords = !!lines?.[active]?.words?.length;
  useEffect(() => {
    if (!activeHasWords) return;
    let raf = 0;
    const paint = () => {
      const s = usePlayer.getState();
      const pos = currentPosition(s);
      for (const el of boxRef.current?.querySelectorAll(`[data-line="${active}"] [data-ws]`) ?? []) {
        const start = Number(el.dataset.ws);
        const end = Number(el.dataset.we);
        const p = Math.max(0, Math.min(1, (pos - start) / Math.max(1, end - start)));
        el.style.setProperty("--p", `${(p * 112 - 6).toFixed(1)}%`); // -6..106%: the soft edge clears both ends
      }
      if (s.isPlaying) raf = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [active, activeHasWords, clock.isPlaying, clock.positionAt]);

  const markManual = () => (manualAt.current = Date.now());
  const text = wide ? "text-xl xl:text-2xl" : "text-2xl";

  let content;
  if (loading) content = <p className="text-center text-gray-400">Looking for lyrics…</p>;
  else if (error) content = <p className="text-center text-gray-400">Couldn’t reach the lyrics service. Try again later.</p>;
  else if (!data) content = <p className="text-center text-gray-400">No lyrics found for this song.</p>;
  else if (data.instrumental) content = <p className="text-center text-2xl font-bold text-gray-300">♪ Instrumental ♪</p>;
  else if (lines)
    content = lines.map((line, i) => (
      <button
        key={`${line.timeMs}-${i}`}
        data-line={i}
        onClick={() => playingThis && seek(line.timeMs)}
        disabled={!playingThis}
        // Three distinct states so styles never blend: sung lines muted, upcoming lines faintest, the
        // current line either white (line timing) or filling word by word (karaoke) with no glow,
        // so unsung words don't look sung.
        className={`block w-full break-words py-2.5 text-center font-bold leading-snug will-change-transform ${text} ${
          i === active
            ? line.words?.length
              ? ""
              : "text-white transition-colors duration-300 [text-shadow:0_0_24px_rgba(255,255,255,0.3)]"
            : i < active
            ? "text-white/45 transition-colors duration-300 hover:text-white/70"
            : "text-white/25 transition-colors duration-300 hover:text-white/60"
        } ${playingThis ? "cursor-pointer" : "cursor-default"}`}
      >
        {i === active && line.words?.length
          ? // Karaoke: each word fills with white as it's sung (painted per frame, see the effect above).
            line.words.map((w, j) => (
              <span key={j} data-ws={w.timeMs} data-we={wordEnd(lines, i, j)} className="karaoke-word">
                {w.text}
              </span>
            ))
          : line.text || "♪"}
      </button>
    ));
  else
    // Only unsynced lyrics (LRCLIB has no timings for this song): line by line so the convex scroll
    // works per line, with a note saying why nothing follows the music.
    content = (
      <>
        <p className="mb-6 text-center text-xs uppercase tracking-widest text-gray-400">Not synced · scroll to read</p>
        {data.plain.split(/\r?\n/).map((line, i) => (
          <p key={i} data-line={i} className={`break-words py-2 text-center font-bold leading-snug text-white/80 ${text}`}>
            {line || " "}
          </p>
        ))}
      </>
    );

  return (
    <div
      ref={boxRef}
      onScroll={onScroll}
      onWheel={markManual}
      onTouchMove={markManual}
      className="scrollbar-hide relative h-full overflow-y-auto px-6 [mask-image:linear-gradient(transparent,black_18%,black_82%,transparent)]"
    >
      {/* Half-height spacers let the first and last lines reach the center. */}
      <div className="h-1/2" aria-hidden />
      {content}
      <div className="h-1/2" aria-hidden />
    </div>
  );
};

// Desktop: a panel beside the player that steps out of the shadow on the right.
// Phones: no room beside it, so full screen, same drum.
export default function Lyrics({ track }) {
  const open = usePlayer((s) => s.lyricsOpen);
  const { wide, panel, gap } = usePanelSize();
  const { toggleLyrics, togglePlay } = usePlayer.getState();
  const isPlaying = usePlayer((s) => s.isPlaying);
  const playingThis = usePlayer((s) => s.track?.uri === track?.uri);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && toggleLyrics();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggleLyrics]);

  const visible = open && !!track;

  if (wide)
    return (
      <AnimatePresence initial={false}>
        {visible && (
          // The panel's width (and its gap) grows from 0, so the player beside it glides aside frame by
          // frame and glides back on close. Animating the panel, not the player: a layout animation on
          // the player didn't run, because opening lyrics doesn't re-render the player.
          <motion.aside
            key="lyrics-panel"
            aria-label="Lyrics"
            initial={{ width: 0, marginLeft: 0 }}
            animate={{ width: panel, marginLeft: gap }}
            exit={{ width: 0, marginLeft: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="relative h-[min(560px,64vh)] shrink-0 overflow-hidden"
          >
            {/* Fixed width inside, so lines don't rewrap while the panel opens; it steps out of the
                shadow: blur, slide and fade. */}
            <motion.div
              initial={{ opacity: 0, x: 60, filter: "blur(16px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 60, filter: "blur(16px)" }}
              transition={{ duration: 0.7, ease: EASE }}
              className="absolute inset-y-0 left-0"
              style={{ width: panel }}
            >
              <LyricsBody track={track} wide />
            </motion.div>
          </motion.aside>
        )}
      </AnimatePresence>
    );

  const cover = track?.album?.images?.[0]?.url;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="lyrics-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-base text-white"
          role="dialog"
          aria-label="Lyrics"
        >
          {cover && (
            <div
              className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-3xl saturate-150"
              style={{ backgroundImage: `url(${cover})` }}
            />
          )}
          <div className="absolute inset-0 bg-black/40" />
          <header className="relative z-10 flex items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{track?.name}</p>
              <p className="truncate text-xs text-gray-300">{track?.artists?.map((a) => a.name).join(", ")}</p>
            </div>
            <button onClick={toggleLyrics} className="rounded-full p-2 text-gray-300 hover:bg-white/10 hover:text-white" aria-label="Close lyrics">
              <FiX className="h-5 w-5" />
            </button>
          </header>
          <div className="relative z-10 min-h-0 flex-1">
            <LyricsBody track={track} wide={false} />
          </div>
          <footer className="relative z-10 flex h-20 items-center justify-center">
            {playingThis && (
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
              >
                {isPlaying ? <BsPauseFill className="h-6 w-6" /> : <BsPlayFill className="ml-0.5 h-6 w-6" />}
              </button>
            )}
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
