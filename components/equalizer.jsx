// Bouncing bars: the loading indicator, and the "this is playing" mark (paused = bars at rest).
// Each bar has its own speed, so the motion doesn't read as one mechanical loop.
const BARS = [
  [0.9, -0.2],
  [1.15, -0.55],
  [0.8, -0.35],
  [1.05, -0.75],
];

export default function Equalizer({ className = "h-4 w-4", playing = true, label }) {
  return (
    <span role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`inline-flex items-end gap-[2px] ${className}`}>
      {BARS.map(([duration, delay], i) => (
        <span
          key={i}
          className="eq-bar h-full flex-1 rounded-full bg-current"
          style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s`, animationPlayState: playing ? "running" : "paused" }}
        />
      ))}
    </span>
  );
}

// Loading state for a section or a page: the bars, and optionally a line of text.
export const Loader = ({ text, className = "py-10" }) => (
  <div className={`flex flex-col items-center justify-center gap-3 text-gray-400 ${className}`}>
    <Equalizer className="h-6 w-6 text-white/70" label={text ?? "Loading"} />
    {text && <p className="text-sm">{text}</p>}
  </div>
);
