import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { FiChevronDown, FiLogOut } from "react-icons/fi";
import { BsBell, BsKeyboard } from "react-icons/bs";
import { usePlayer } from "@/store/player";

const noSubscribe = () => () => {};

const TopBar = () => {
  const { data: session } = useSession();
  const notifyOn = usePlayer((s) => s.songNotifications);
  // iPhone Safari has no site notifications (only home-screen apps do): no menu item there.
  const canNotify = useSyncExternalStore(noSubscribe, () => typeof Notification !== "undefined", () => false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!session) return null;
  const { name, image } = session.user;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-black/60 p-1 pr-2 transition-colors duration-200 hover:bg-black/80"
      >
        <span className="relative h-7 w-7 overflow-hidden rounded-full bg-elevated">
          {image && (
            <Image src={image} alt={name ?? "User"} fill sizes="28px" className="object-cover" />
          )}
        </span>
        <span className="hidden text-sm font-semibold sm:inline">{name}</span>
        <FiChevronDown
          className={`h-4 w-4 text-gray-300 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-52 overflow-hidden rounded-xl bg-black/60 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl glass-panel">
          <button
            onClick={() => {
              setOpen(false);
              usePlayer.getState().toggleHelp();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-gray-200 transition-colors duration-200 hover:bg-white/10"
          >
            <BsKeyboard className="h-4 w-4" />
            Keyboard shortcuts
            <kbd className="ml-auto rounded bg-white/10 px-1.5 text-[10px] text-gray-400">?</kbd>
          </button>
          {canNotify && (<button
            onClick={() => usePlayer.getState().toggleSongNotifications()}
            role="switch"
            aria-checked={notifyOn}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-gray-200 transition-colors duration-200 hover:bg-white/10"
          >
            <BsBell className="h-4 w-4" />
            Song notifications
            <span className={`ml-auto h-2 w-2 rounded-full ${notifyOn ? "bg-spotify" : "bg-white/20"}`} aria-hidden />
          </button>)}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-gray-200 transition-colors duration-200 hover:bg-white/10"
          >
            <FiLogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default TopBar;
