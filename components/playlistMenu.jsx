import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { useRecoilState } from "recoil";
import { FiMusic, FiX } from "react-icons/fi";
import { playlistIdState } from "@/atoms/playlistAtoms";
import useSpotify from "@/hooks/useSpotify";

const PlaylistMenu = () => {
  const spotifyApi = useSpotify();
  const { data: session } = useSession();
  const [playlists, setPlaylists] = useState([]);
  const [playlistId, setPlaylistId] = useRecoilState(playlistIdState);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!spotifyApi.getAccessToken()) return;
    spotifyApi
      .getUserPlaylists({ limit: 50 })
      .then((data) => setPlaylists(data.body.items))
      .catch((e) => console.error("Failed to load playlists", e));
  }, [session, spotifyApi]);

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
            {playlists.map((pl) => {
              const isActive = pl.id === playlistId;
              const cover = pl.images?.[0]?.url;
              return (
                <button
                  key={pl.id}
                  onClick={() => {
                    setPlaylistId(pl.id);
                    setOpen(false);
                  }}
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
                    <span className="block truncate text-xs text-gray-400">
                      {pl.tracks?.total ?? 0} songs
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
