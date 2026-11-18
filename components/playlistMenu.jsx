import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { FiClock, FiHeart, FiLock, FiMusic, FiTrendingUp, FiX } from "react-icons/fi";
import { COLLECTIONS, canReadItems, playlistTotal, usePlayer } from "@/store/player";
import { coverUrl } from "@/lib/playback";

// Library collections above the playlists: [key, icon, cover gradient].
const LIBRARY = [
  ["liked", FiHeart, "from-indigo-500 to-fuchsia-400"],
  ["recent", FiClock, "from-sky-600 to-emerald-400"],
  ["top:short_term", FiTrendingUp, "from-amber-500 to-rose-500"],
  ["top:medium_term", FiTrendingUp, "from-rose-500 to-purple-600"],
  ["top:long_term", FiTrendingUp, "from-purple-600 to-indigo-700"],
];

const PlaylistMenu = () => {
  const playlists = usePlayer((s) => s.playlists); // loaded once by Experience
  const userId = usePlayer((s) => s.userId);
  const playlistId = usePlayer((s) => s.playlistId);
  const setPlaylistId = usePlayer((s) => s.selectPlaylist);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative z-30">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Your playlists"
        className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-sm text-gray-300 ring-1 ring-white/10 transition-colors duration-200 hover:bg-white/10 hover:text-white"
      >
        <FiMusic className="h-4 w-4" />
        <span className="hidden sm:inline">Playlists</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="scroll-thin absolute left-0 top-12 max-h-[70vh] w-72 overflow-y-auto rounded-xl bg-elevated p-2 shadow-2xl ring-1 ring-white/10"
          >
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Your Library
              </span>
              <button onClick={() => setOpen(false)} className="icon-btn" aria-label="Close">
                <FiX className="h-4 w-4" />
              </button>
            </div>
            {LIBRARY.map(([key, Icon, gradient]) => {
              const isActive = key === playlistId;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setPlaylistId(key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors duration-200 ${
                    isActive ? "bg-hover" : "hover:bg-hover"
                  }`}
                >
                  <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br ${gradient}`}>
                    <Icon className="h-4 w-4 text-white" aria-hidden />
                  </span>
                  <span className={`truncate text-sm ${isActive ? "text-spotify" : "text-white"}`}>{COLLECTIONS[key].name}</span>
                </button>
              );
            })}
            <div className="mx-2 my-2 border-t border-white/10" />
            {playlists.map((pl) => {
              const isActive = pl.id === playlistId;
              const cover = coverUrl(pl.images, 80);
              const playOnly = !canReadItems(pl, userId);
              return (
                <button
                  key={pl.id}
                  onClick={() => {
                    setPlaylistId(pl.id);
                    setOpen(false);
                  }}
                  title={playOnly ? "Play-only: Spotify hides the track list of playlists you don’t own" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors duration-200 ${
                    isActive ? "bg-hover" : "hover:bg-hover"
                  }`}
                >
                  <span className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-panel">
                    {cover && (
                      <Image src={cover} alt={pl.name} fill sizes="40px" className="object-cover" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-sm ${isActive ? "text-spotify" : "text-white"}`}>
                      {pl.name}
                    </span>
                    <span className="flex items-center gap-1 truncate text-xs text-gray-400">
                      {playlistTotal(pl)} songs
                      {playOnly && (
                        <>
                          <span aria-hidden>·</span>
                          <FiLock className="h-3 w-3 shrink-0" aria-hidden />
                          play-only
                        </>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PlaylistMenu;
