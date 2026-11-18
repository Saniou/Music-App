import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FiX } from "react-icons/fi";
import { BsDownload, BsShare } from "react-icons/bs";
import { coverUrl, currentPosition } from "@/lib/playback";
import { activeLine, fetchLyrics } from "@/lib/lyrics";
import { usePlayer } from "@/store/player";

const W = 1080;
const H = 1350; // 4:5, what Instagram and most feeds show uncropped
const EASE = [0.22, 1, 0.36, 1];

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Spotify's CDN allows it; without it the canvas can't be exported
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Up to maxLines lines of `text` within maxWidth, the last one ellipsized if it doesn't all fit.
function wrap(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && lines.join(" ").length < text.length) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines.filter(Boolean);
}

// The card: the cover blurred as the background, the cover itself, title, artist, an optional lyric
// line in quotes, and the app's name. Returns a PNG blob.
async function drawCard(track, line) {
  const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const ctx = canvas.getContext("2d");
  const img = await loadImage(coverUrl(track.album?.images, 640));
  await Promise.all([document.fonts.load('700 56px "Poppins"'), document.fonts.load('700 72px "Dancing Script"')]).catch(() => {});

  ctx.filter = "blur(70px) saturate(1.5)"; // ignored where unsupported: then just a dimmed cover
  ctx.drawImage(img, -250, -150, H + 500, H + 500);
  ctx.filter = "none";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, W, H);

  const size = 680;
  const x = (W - size) / 2;
  const y = line ? 130 : 190;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 20;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 36);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 36);
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();

  ctx.textAlign = "center";
  let ty = y + size + 110;
  ctx.fillStyle = "#fff";
  ctx.font = '700 58px "Poppins", sans-serif';
  for (const l of wrap(ctx, track.name, 900, 2)) {
    ctx.fillText(l, W / 2, ty);
    ty += 68;
  }
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = '500 38px "Poppins", sans-serif';
  ctx.fillText(wrap(ctx, track.artists.map((a) => a.name).join(", "), 900, 1)[0] ?? "", W / 2, ty);

  if (line) {
    ty += 90;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = 'italic 600 40px "Poppins", sans-serif';
    for (const l of wrap(ctx, `“${line}”`, 880, 2)) {
      ctx.fillText(l, W / 2, ty);
      ty += 54;
    }
  }

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = '700 64px "Dancing Script", cursive';
  ctx.fillText("Musify", W / 2, H - 70);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// The lyric line being sung right now, if the song has synced lyrics and is playing.
async function currentLine(track) {
  const s = usePlayer.getState();
  if (s.track?.uri !== track.uri) return null;
  const lyrics = await fetchLyrics(track).catch(() => null);
  const lines = lyrics?.synced;
  if (!lines) return null;
  const i = activeLine(lines, currentPosition(s));
  return (i >= 0 && lines[i].text) || null;
}

const Modal = ({ track, onClose }) => {
  const [line, setLine] = useState(undefined); // undefined: still looking
  const [withLine, setWithLine] = useState(true);
  const [card, setCard] = useState(null); // { key, blob, url }
  const key = `${track.uri}|${withLine ? line ?? "" : ""}`;

  useEffect(() => {
    let alive = true;
    currentLine(track).then((l) => alive && setLine(l));
    return () => {
      alive = false;
    };
  }, [track]);

  useEffect(() => {
    if (line === undefined) return;
    let alive = true;
    let url;
    drawCard(track, withLine ? line : null)
      .then((blob) => {
        if (!alive || !blob) return;
        url = URL.createObjectURL(blob);
        setCard({ key, blob, url });
      })
      .catch((e) => console.warn("Share card failed", e));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [track, line, withLine, key]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ready = card?.key === key;
  const fileName = `${track.name} - ${track.artists[0]?.name ?? ""}.png`.replace(/[\\/:*?"<>|]/g, "");
  const file = ready ? new File([card.blob], fileName, { type: "image/png" }) : null;
  const canShare = !!file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] });

  const share = async () => {
    try {
      await navigator.share({ files: [file], title: track.name, text: `${track.name} — ${track.artists.map((a) => a.name).join(", ")}` });
    } catch {} // cancelled
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Share card"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.35, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-[20px] bg-black/50 p-4 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-script text-2xl font-bold leading-normal">Share</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Close">
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
          {ready ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, nothing to optimize
            <img src={card.url} alt={`Card for ${track.name}`} className="h-full w-full object-cover" />
          ) : (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">Making your card…</p>
          )}
        </div>
        {line && (
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 px-1 text-sm text-gray-300">
            <span className="min-w-0 truncate">Include “{line}”</span>
            <input type="checkbox" checked={withLine} onChange={(e) => setWithLine(e.target.checked)} className="h-4 w-4 shrink-0 accent-white" />
          </label>
        )}
        <div className="mt-4 flex gap-2">
          {canShare && (
            <button
              onClick={share}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
            >
              <BsShare className="h-4 w-4" /> Share
            </button>
          )}
          <a
            href={ready ? card.url : undefined}
            download={fileName}
            aria-disabled={!ready}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold ring-1 ring-white/15 transition-colors ${
              canShare ? "bg-white/5 text-white hover:bg-white/10" : "bg-white text-black"
            } ${ready ? "" : "pointer-events-none opacity-50"}`}
          >
            <BsDownload className="h-4 w-4" /> Download
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
};

// A shareable image of a song (and the line being sung). Rendered into <body>: it's opened from the
// player, which sits in a transformed (animated) box that would trap `position: fixed`.
export default function ShareCard({ track, onClose }) {
  if (typeof document === "undefined") return null;
  return createPortal(<AnimatePresence>{track && <Modal track={track} onClose={onClose} />}</AnimatePresence>, document.body);
}
