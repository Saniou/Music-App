import { useEffect, useState } from "react";
import { majorityTone, vividColor } from "@/lib/playback";

const SIZE = 24; // a 24x24 sample is plenty for overall colour
const cache = new Map(); // url -> { tone, vivid }

// { tone: "light" | "dark", vivid: "rgb(...)" | null } for a cover image url. Spotify's CDN allows CORS,
// so the canvas isn't tainted; if it ever is, the previous colours stay.
export default function useCoverColors(url) {
  const [colors, setColors] = useState({ tone: "light", vivid: null });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const done = (c) => alive && setColors(c);
    if (cache.has(url)) {
      queueMicrotask(() => done(cache.get(url)));
      return () => {
        alive = false;
      };
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const ctx = Object.assign(document.createElement("canvas"), { width: SIZE, height: SIZE }).getContext("2d", {
          willReadFrequently: true,
        });
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
        const c = { tone: majorityTone(data), vivid: vividColor(data) };
        cache.set(url, c);
        done(c);
      } catch {} // tainted canvas: keep the previous colours
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return colors;
}
