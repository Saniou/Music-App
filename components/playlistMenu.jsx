import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { FiClock, FiHeart, FiLock, FiMusic, FiTrendingUp, FiX } from "react-icons/fi";
import { canReadItems, playlistTotal, usePlayer } from "@/store/player";
import { coverUrl } from "@/lib/playback";

const EASE = [0.22, 1, 0.36, 1];

// Library collections above the playlists: [key, icon, title, subtitle].
const LIBRARY = [
  ["liked", FiHeart, "Liked Songs", "Your saved songs"],
  ["recent", FiClock, "Recently played", "Your last 50 plays"],
  ["top:short_term", FiTrendingUp, "Top tracks", "Last 4 weeks"],
  ["top:medium_term", FiTrendingUp, "Top tracks", "Last 6 months"],
  ["top:long_term", FiTrendingUp, "Top tracks", "All time"],
];

const Label = ({ children }) => (
  <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 first:pt-1">{children}</p>
);

const Row = ({ active, onClick, title, art, children, hint }) => (
  <button
    onClick={onClick}
    title={hint}
    className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors duration-200 ${
      active ? "bg-white/10" : "hover:bg-white/5"
    }`}
  >
    {art}
    <span className="min-w-0 flex-1">
      <span className={`block truncate text-sm ${active ? "text-spotify" : "text-white"}`}>{title}</span>
      <span className="flex items-center gap-1 truncate text-xs text-gray-400">{children}</span>
    </span>
  </button>
);

// Library and playlists. Same glass as the side panel: tinted by the playing cover, rounded,
// quiet outlined icons rather than bright tiles.
const PlaylistMenu = () => {
  const playlists = usePlayer((s) => s.playlists); // loaded once by Experience
  const userId = usePlayer((s) => s.userId);
  const playlistId = usePlayer((s) => s.playlistId);
  const tint = usePlayer((s) => coverUrl(s.track?.album?.images, 300));
  const select = usePlayer((s) => s.selectPlaylist);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id) => {
    select(id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative z-30">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Your library"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm ring-1 ring-white/10 transition-colors duration-200 hover:bg-white/10 hover:text-white ${
          open ? "bg-white/10 text-white" : "bg-white/5 text-gray-300"
        }`}
      >
        <FiMusic className="h-4 w-4" />
        <span className="hidden sm:inline">Library</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.25, ease: EASE }}
            style={{ transformOrigin: "top left" }}
            className="absolute left-0 top-12 flex max-h-[75vh] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[20px] bg-black/45 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl glass-panel"
          >
            {tint && (
              <div
                className="pointer-events-none absolute -inset-10 bg-cover bg-center opacity-25 blur-3xl saturate-150 cover-glow"
                style={{ backgroundImage: `url(${tint})` }}
              />
            )}
            <div className="relative flex items-center justify-between px-4 pb-1 pt-3">
              <span className="font-script text-2xl font-bold leading-normal">Your library</span>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="scroll-thin relative min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <Label>Library</Label>
              {LIBRARY.map(([key, Icon, title, subtitle]) => (
                <Row
                  key={key}
                  active={key === playlistId}
                  onClick={() => pick(key)}
                  title={title}
                  art={
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-gray-300 ring-1 ring-white/10">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                  }
                >
                  {subtitle}
                </Row>
              ))}

              <Label>Playlists</Label>
              {playlists.map((pl) => {
                const cover = coverUrl(pl.images, 80);
                const playOnly = !canReadItems(pl, userId);
                return (
                  <Row
                    key={pl.id}
                    active={pl.id === playlistId}
                    onClick={() => pick(pl.id)}
                    title={pl.name}
                    hint={playOnly ? "Play-only: Spotify hides the track list of playlists you don’t own" : undefined}
                    art={
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
                        {cover && <Image src={cover} alt="" fill sizes="40px" className="object-cover" />}
                      </span>
                    }
                  >
                    {playlistTotal(pl)} songs
                    {playOnly && (
                      <>
                        <span aria-hidden>·</span>
                        <FiLock className="h-3 w-3 shrink-0" aria-hidden />
                        play-only
                      </>
                    )}
                  </Row>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PlaylistMenu;
