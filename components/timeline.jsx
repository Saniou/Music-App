import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { coverUrl } from "@/lib/playback";

const BASE = 56; // px, resting tile
const MAX = 84; // px, tile right under the cursor
const REACH = 150; // px from the cursor where magnification fades out
const DRAG_THRESHOLD = 5; // px of mouse travel before a press becomes a drag, not a click

// Magnify only with a real mouse on a wide screen; touch gets plain swipe + snap.
function useCanMagnify() {
  const [can, setCan] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 640px)");
    const update = () => setCan(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return can;
}

// Smooth horizontal scrolling: the scroller eases toward a target instead of jumping. Wheel notches
// add to the target; a released drag throws it with momentum. Plain closure state, driven by rAF.
const GLIDE_EASE = 0.14; // share of the remaining distance covered per frame
const MOMENTUM_MS = 260; // how far a throw carries: velocity (px/ms) x this
function makeGlider(getEl) {
  let target = null;
  let raf = 0;
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    target = null;
  };
  const step = () => {
    const el = getEl();
    if (!el || target === null) return stop();
    const diff = target - el.scrollLeft;
    if (Math.abs(diff) < 0.5) {
      el.scrollLeft = target;
      return stop();
    }
    el.scrollLeft += diff * GLIDE_EASE;
    raf = requestAnimationFrame(step);
  };
  const by = (dx) => {
    const el = getEl();
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    target = Math.min(max, Math.max(0, (target ?? el.scrollLeft) + dx));
    if (!raf) raf = requestAnimationFrame(step);
  };
  return { by, stop };
}

// Dock-style tile: its size follows the cursor's distance, so neighbours grow a little too. It also
// listens to scrollX, so tiles gliding under a still cursor resize as they pass.
// The hovered tile's name. It lives outside the scroller (which clips), follows the tile while it
// animates, and is clamped so it never runs off the first or last tile's edge. Its frame loop exists
// only while it's mounted, i.e. while something is hovered.
const HoverLabel = ({ tile, wrapRef, children }) => {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  useAnimationFrame(() => {
    const wrap = wrapRef.current;
    const label = ref.current;
    if (!tile || !wrap || !label) return;
    const t = tile.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    const half = label.offsetWidth / 2;
    const center = Math.min(Math.max(t.left + t.width / 2 - w.left, half + 4), w.width - half - 4);
    x.set(center - half);
    y.set(t.top - w.top - label.offsetHeight - 8);
  });
  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{ x, y }}
      className="pointer-events-none absolute left-0 top-0 z-20 max-w-[240px] truncate whitespace-nowrap rounded-md bg-black px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/10"
    >
      {children}
    </motion.span>
  );
};

const MagnifiedTile = ({ mouseX, scrollX, refCb, children, ...props }) => {
  const ref = useRef(null);
  const distance = useTransform([mouseX, scrollX], ([x]) => {
    const b = ref.current?.getBoundingClientRect();
    return b ? x - b.left - b.width / 2 : Infinity;
  });
  const size = useSpring(useTransform(distance, [-REACH, 0, REACH], [BASE, MAX, BASE]), {
    mass: 0.1,
    stiffness: 170,
    damping: 14,
  });
  return (
    <motion.button
      {...props}
      ref={(el) => {
        ref.current = el;
        refCb(el);
      }}
      style={{ width: size, height: size }}
    >
      {children}
    </motion.button>
  );
};

const Timeline = ({ items, activeIndex, onSelect }) => {
  const wrapRef = useRef(null);
  const scrollRef = useRef(null);
  const itemRefs = useRef({}); // keyed by the track's index in the full playlist
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const mouseX = useMotionValue(Infinity);
  const scrollX = useMotionValue(0);
  const [hovered, setHovered] = useState(null);
  const [hoveredEl, setHoveredEl] = useState(null); // the hovered tile element, for its label to follow
  const canMagnify = useCanMagnify();
  // The glider is made once the scroller exists (an effect may read the DOM; render may not).
  const glider = useRef(null);
  const hasItems = items.length > 0;

  // Keep the active cover in view as it changes.
  useEffect(() => {
    glider.current?.stop(); // the browser's smooth scroll takes over
    itemRefs.current[activeIndex]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeIndex]);

  // A plain mouse wheel only scrolls vertically; turn it into eased timeline scrolling.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const g = (glider.current = makeGlider(() => el));
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // trackpad sideways swipes scroll natively
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1; // lines / pages / px
      g.by(e.deltaY * unit);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      g.stop();
      glider.current = null;
    };
  }, [hasItems]);

  // The label lives outside the scroller (which clips), follows the hovered tile while it
  // animates, and is clamped so it never runs off the first or last tile's edge.
  // (The per-frame follow lives in HoverLabel, so it only runs while a label shows: a frame loop
  // that never stops was a steady cost on phones, where nothing is ever hovered.)

  const onPointerDown = (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    glider.current?.stop(); // grabbing stops a glide in progress
    drag.current = { x: e.clientX, left: scrollRef.current.scrollLeft, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
    const end = () => {
      const d = drag.current;
      suppressClick.current = !!d?.moved; // the click that follows a drag is not a pick
      // Throw: keep going in the drag's direction and ease to a stop.
      if (d?.moved && Math.abs(d.v) > 0.05) glider.current?.by(-d.v * MOMENTUM_MS);
      drag.current = null;
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointerup", end);
  };

  const onPointerMove = (e) => {
    if (e.pointerType !== "mouse") return;
    mouseX.set(e.clientX);
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > DRAG_THRESHOLD) d.moved = true;
    if (!d.moved) return;
    scrollRef.current.scrollLeft = d.left - dx;
    // Velocity in px/ms, smoothed so one jittery sample doesn't decide the throw.
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = 0.7 * ((e.clientX - d.lastX) / dt) + 0.3 * d.v;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
  };

  if (!items.length) {
    return <p className="py-10 text-center text-sm text-gray-500">No matches in this playlist.</p>;
  }

  const hoveredTrack = items.find((x) => x.index === hovered)?.track;
  const hoveredTile = hovered != null ? hoveredEl : null;

  return (
    <div ref={wrapRef} className="relative flex flex-col items-center gap-1">
      <AnimatePresence>
        {hoveredTrack && (
          <HoverLabel key="label" tile={hoveredTile} wrapRef={wrapRef}>
            {hoveredTrack.name}
          </HoverLabel>
        )}
      </AnimatePresence>

      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onScroll={(e) => scrollX.set(e.currentTarget.scrollLeft)}
        onPointerLeave={() => {
          mouseX.set(Infinity);
          setHovered(null);
        }}
        onClickCapture={(e) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          e.stopPropagation();
          e.preventDefault();
        }}
        onDragStart={(e) => e.preventDefault()}
        // Fixed height fits the biggest tile, so magnifying never shifts the page.
        className={`scrollbar-hide w-full max-w-6xl select-none overflow-x-auto ${
          canMagnify ? "cursor-grab active:cursor-grabbing" : "snap-x snap-mandatory"
        }`}
        style={{ height: (canMagnify ? MAX : BASE) + 20 }}
      >
        {/* w-max + mx-auto: centered while it fits, scrollable once it doesn't.
            On touch, half-width side padding lets the first and last covers snap to the center. */}
        <div
          className={`mx-auto flex h-full w-max items-end gap-3 pb-2 ${
            canMagnify ? "px-10" : "px-[calc(50vw-22px)]"
          }`}
        >
          {items.map(({ track, index }) => {
            const isActive = index === activeIndex;
            const cover = coverUrl(track.album?.images, MAX * 2); // 2x for retina
            const key = `${track.id}-${index}`;
            const tileProps = {
              onClick: () => onSelect(index),
              onPointerEnter: (e) => {
                setHovered(index);
                setHoveredEl(e.currentTarget);
              },
              onFocus: (e) => {
                setHovered(index);
                setHoveredEl(e.currentTarget);
              },
              onBlur: () => setHovered(null),
              refCb: (el) => (itemRefs.current[index] = el),
              className: "group relative flex-shrink-0 snap-center outline-none",
              "aria-label": track.name,
              "aria-current": isActive || undefined,
            };
            const inner = (
              <span
                className={`relative block h-full w-full overflow-hidden rounded-xl shadow-md group-focus-visible:ring-2 group-focus-visible:ring-white/70 ${
                  isActive ? "ring-2 ring-white ring-offset-2 ring-offset-base" : "ring-1 ring-white/10"
                }`}
              >
                {cover && (
                  <Image src={cover} alt="" fill sizes={`${MAX}px`} draggable={false} className="object-cover" />
                )}
              </span>
            );
            if (canMagnify)
              return (
                <MagnifiedTile key={key} {...tileProps} mouseX={mouseX} scrollX={scrollX}>
                  {inner}
                </MagnifiedTile>
              );
            const { refCb, ...rest } = tileProps;
            return (
              <button key={key} {...rest} ref={refCb} className={`${rest.className} h-11 w-11`}>
                {inner}
              </button>
            );
          })}
        </div>
      </div>
      <p className="select-none text-xs tracking-widest text-gray-500">&lt;&lt; scroll timeline &gt;&gt;&gt;</p>
    </div>
  );
};

export default Timeline;
