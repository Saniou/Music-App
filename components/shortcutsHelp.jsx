import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiX } from "react-icons/fi";
import { usePlayer } from "@/store/player";

export const SHORTCUTS = [
  [["Space"], "Play / pause"],
  [["←", "→"], "Previous / next song"],
  [["Shift", "←  →"], "Back / forward 10 seconds"],
  [["↑", "↓"], "Volume up / down"],
  [["M"], "Mute / unmute"],
  [["L"], "Lyrics"],
  [["F"], "Ambient mode (full screen)"],
  [["/"], "Search this playlist"],
  [["?"], "This help"],
  [["Esc"], "Close what's open"],
];

const Key = ({ children }) => (
  <kbd className="min-w-7 rounded-md bg-white/10 px-2 py-0.5 text-center font-sans text-xs text-white ring-1 ring-white/15">{children}</kbd>
);

export default function ShortcutsHelp() {
  const open = usePlayer((s) => s.helpOpen);
  const toggleHelp = usePlayer((s) => s.toggleHelp);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && toggleHelp();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggleHelp]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={toggleHelp}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-label="Keyboard shortcuts"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[20px] bg-black/50 p-5 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-script text-2xl font-bold leading-normal">Shortcuts</h2>
              <button onClick={toggleHelp} className="rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Close">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <ul className="space-y-2.5">
              {SHORTCUTS.map(([keys, label]) => (
                <li key={label} className="flex items-center justify-between gap-4 text-sm text-gray-300">
                  {label}
                  <span className="flex shrink-0 gap-1">
                    {keys.map((k) => (
                      <Key key={k}>{k}</Key>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
