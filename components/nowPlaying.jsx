import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { coverUrl, majorityTone } from "@/lib/playback";
import { FaSpotify } from "react-icons/fa";
import { BsHeart, BsHeartFill, BsPlayFill, BsPauseFill } from "react-icons/bs";
import { usePlayer } from "@/store/player";
import { TbPlayerTrackPrevFilled, TbPlayerTrackNextFilled } from "react-icons/tb";
import PlaybackBar from "./playbackBar";

// A soft sheen over a silver or a black base, like light on a CD.
const DISC_FINISH = {
  light:
    "radial-gradient(circle, transparent 0 15%, rgba(255,255,255,.55) 15.5% 16.5%, transparent 17%), conic-gradient(from 30deg, #cfd2d6, #f4f5f7, #b9bdc3, #e9d9f2, #cde9f0, #f6f0d8, #c2c6cc, #f4f5f7, #cfd2d6)",
  dark:
    "radial-gradient(circle, transparent 0 15%, rgba(255,255,255,.14) 15.5% 16.5%, transparent 17%), conic-gradient(from 30deg, #18181b, #2e2e33, #0f0f11, #2a2533, #1c2228, #302b24, #111113, #2e2e33, #18181b)",
};

// Whether the cover is mostly light or dark, from a 24×24 sample. Spotify's CDN allows CORS,
// so the canvas isn't tainted; if it ever is, the disc just keeps its current finish.
function useCoverTone(url) {
  const [tone, setTone] = useState("light");
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 24;
        const ctx = Object.assign(document.createElement("canvas"), { width: size, height: size }).getContext("2d", {
          willReadFrequently: true,
        });
        ctx.drawImage(img, 0, 0, size, size);
        if (alive) setTone(majorityTone(ctx.getImageData(0, 0, size, size).data));
      } catch {} // tainted canvas: keep the current finish
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return tone;
}

const NowPlaying = ({ track, isPlaying, onPlayPause, onNext, onPrev, hasNext, hasPrev }) => {
  const cover = track?.album?.images?.[0]?.url;
  const spotifyUrl = track?.url;
  const tone = useCoverTone(coverUrl(track?.album?.images, 64)); // the smallest size is plenty
  const { openDrawer, selectPlaylist, toggleLike, checkLiked } = usePlayer.getState();
  const liked = usePlayer((s) => !!s.liked[track?.uri]);
  const albumId = track?.album?.id;
  useEffect(() => {
    checkLiked(track?.uri);
  }, [track?.uri, checkLiked]);

  return (
    <div className="flex w-full max-w-md flex-col items-center">
      {/* Open in Spotify */}
      <a
        href={spotifyUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className={`mb-6 flex items-center sm:mb-10 gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-gray-300 ring-1 ring-white/10 transition-colors duration-200 hover:bg-white/10 hover:text-white ${
          spotifyUrl ? "" : "pointer-events-none opacity-40"
        }`}
      >
        <FaSpotify className="h-4 w-4 text-spotify" />
        Open in Spotify
      </a>

      {/* Cover + disc */}
      <div className="relative h-52 w-52 sm:h-72 sm:w-72">
        {/* CD centered behind the cover, sliding out to the right. Positioned with inset, not
            translate classes: framer-motion owns `transform`, so it would drop them. */}
        <motion.div
          className="absolute inset-[4%] z-0"
          initial={false}
          animate={{ x: isPlaying ? "30%" : "20%" }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        >
          <div
            className={`relative h-full w-full overflow-hidden rounded-full shadow-xl ring-1 ring-black/30 ${
              isPlaying ? "animate-spin-slow" : ""
            }`}
          >
            {/* Both finishes stacked; the cover's tone crossfades between them. */}
            {Object.entries(DISC_FINISH).map(([name, background]) => (
              <div
                key={name}
                className="absolute inset-0 transition-opacity duration-700"
                style={{ background, opacity: tone === name ? 1 : 0 }}
              />
            ))}
            {/* Center hole */}
            <div className="absolute left-1/2 top-1/2 h-[11%] w-[11%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-base ring-1 ring-black/30" />
          </div>
        </motion.div>

        {/* Album cover */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={track?.id ?? "empty"}
            initial={{ opacity: 0, scale: 0.92, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute inset-0 z-10 overflow-hidden rounded-2xl bg-elevated shadow-2xl ring-1 ring-white/10"
          >
            {cover && (
              <Image src={cover} alt={track?.name ?? "Album cover"} fill sizes="288px" className="object-cover" priority />
            )}
            {albumId && (
              <button
                onClick={() => selectPlaylist(`album:${albumId}`)}
                className="absolute inset-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                aria-label={`Open album ${track.album.name ?? ""}`}
                title={`Open album “${track.album.name ?? ""}”`}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Track meta */}
      {/* min-h, not h: a long title gets two lines instead of spilling over the progress bar. */}
      <div className="mt-5 min-h-[3.5rem] w-full px-2 text-center sm:mt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={track?.id ?? "empty-meta"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <p className="truncate text-sm text-gray-400">
              {track?.artists?.length
                ? track.artists.map((a, i) => (
                    <span key={a.id ?? a.name}>
                      {i > 0 && ", "}
                      {a.id ? (
                        <button onClick={() => openDrawer("artist", { artistId: a.id })} className="hover:text-white hover:underline">
                          {a.name}
                        </button>
                      ) : (
                        a.name
                      )}
                    </span>
                  ))
                : "—"}
            </p>
            <div className="mt-0.5 flex items-start justify-center gap-2">
              <h2 className="line-clamp-2 text-lg font-semibold leading-snug sm:text-xl" title={track?.name}>
                {track?.name ?? "Nothing playing"}
              </h2>
              {track?.uri && (
                <button
                  onClick={() => toggleLike(track)}
                  aria-label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
                  aria-pressed={liked}
                  className={`mt-1 shrink-0 transition-transform duration-200 hover:scale-110 ${liked ? "text-spotify" : "text-gray-400 hover:text-white"}`}
                >
                  {liked ? <BsHeartFill className="h-4 w-4" /> : <BsHeart className="h-4 w-4" />}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <PlaybackBar />

      {/* Controls */}
      <div className="mt-6 flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 ring-1 ring-white/10">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous"
          className="p-2 text-gray-300 transition-colors duration-200 hover:text-white disabled:opacity-30"
        >
          <TbPlayerTrackPrevFilled className="h-5 w-5" />
        </button>
        <button
          onClick={onPlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition-transform duration-200 hover:scale-105"
        >
          {isPlaying ? <BsPauseFill className="h-6 w-6" /> : <BsPlayFill className="ml-0.5 h-6 w-6" />}
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next"
          className="p-2 text-gray-300 transition-colors duration-200 hover:text-white disabled:opacity-30"
        >
          <TbPlayerTrackNextFilled className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default NowPlaying;
