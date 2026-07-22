import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

const Timeline = ({ tracks, activeIndex, onSelect }) => {
  const scrollRef = useRef(null);
  const itemRefs = useRef([]);

  // Keep the active cover centered as it changes.
  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeIndex]);

  if (!tracks.length) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={scrollRef}
        className="scroll-thin flex w-full max-w-5xl items-end gap-4 overflow-x-auto px-[45%] py-4"
      >
        {tracks.map((track, index) => {
          const isActive = index === activeIndex;
          const cover = track.album?.images?.[0]?.url;
          return (
            <motion.button
              key={`${track.id}-${index}`}
              ref={(el) => (itemRefs.current[index] = el)}
              onClick={() => onSelect(index)}
              className="group relative flex-shrink-0"
              animate={{ scale: isActive ? 1.35 : 1, opacity: isActive ? 1 : 0.55 }}
              whileHover={{ opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 22 }}
              aria-label={track.name}
            >
              {/* Tooltip */}
              <span
                className={`pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-[11px] font-medium text-white shadow-lg transition-opacity duration-200 ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {track.name}
              </span>

              <span
                className={`relative block h-14 w-14 overflow-hidden rounded-lg ring-1 transition-all duration-200 ${
                  isActive ? "ring-2 ring-white" : "ring-white/10 group-hover:ring-white/40"
                }`}
              >
                {cover && (
                  <Image src={cover} alt={track.name} fill sizes="56px" className="object-cover" />
                )}
              </span>
            </motion.button>
          );
        })}
      </div>

      <p className="select-none text-xs tracking-widest text-gray-500">
        &lt;&lt; scroll timeline &gt;&gt;
      </p>
    </div>
  );
};

export default Timeline;
