import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { FaSpotify } from "react-icons/fa";
import { BsPlayFill, BsPauseFill } from "react-icons/bs";
import { TbPlayerTrackPrevFilled, TbPlayerTrackNextFilled } from "react-icons/tb";

const NowPlaying = ({ track, isPlaying, onPlayPause, onNext, onPrev, hasNext, hasPrev }) => {
  const cover = track?.album?.images?.[0]?.url;
  const spotifyUrl = track?.external_urls?.spotify;

  return (
    <div className="flex w-full max-w-md flex-col items-center">
      {/* Open in Spotify */}
      <a
        href={spotifyUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className={`mb-10 flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-gray-300 ring-1 ring-white/10 transition-colors duration-200 hover:bg-white/10 hover:text-white ${
          spotifyUrl ? "" : "pointer-events-none opacity-40"
        }`}
      >
        <FaSpotify className="h-4 w-4 text-spotify" />
        Open in Spotify
      </a>

      {/* Cover + disc */}
      <div className="relative h-64 w-64 sm:h-72 sm:w-72">
        {/* Disc sliding out behind the cover */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-[92%] w-[92%] -translate-y-1/2"
          animate={{ x: isPlaying ? "18%" : "6%" }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          style={{ zIndex: 0 }}
        >
          <div
            className={`h-full w-full rounded-full shadow-2xl ${isPlaying ? "animate-spin-slow" : ""}`}
            style={{
              background:
                "repeating-radial-gradient(circle at center, #0d0d0f 0px, #17171b 2px, #0d0d0f 4px), radial-gradient(circle at center, #2a2a2f 0%, #050506 70%)",
            }}
          >
            <div className="flex h-full w-full items-center justify-center">
              <div className="relative h-[38%] w-[38%] overflow-hidden rounded-full ring-2 ring-black/60">
                {cover && (
                  <Image src={cover} alt="" fill sizes="120px" className="object-cover opacity-90" />
                )}
                <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-base ring-2 ring-black/50" />
              </div>
            </div>
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
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Track meta */}
      <div className="mt-8 h-14 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={track?.id ?? "empty-meta"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-sm text-gray-400">
              {track?.artists?.map((a) => a.name).join(", ") || "—"}
            </p>
            <h2 className="mt-0.5 text-xl font-semibold">{track?.name ?? "Nothing playing"}</h2>
          </motion.div>
        </AnimatePresence>
      </div>

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
