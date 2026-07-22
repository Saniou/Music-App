import { signOut } from "next-auth/react";
import { FaSpotify } from "react-icons/fa";
import {
  FiHome,
  FiSearch,
  FiTrendingUp,
  FiHeart,
  FiPlusSquare,
  FiLogOut,
} from "react-icons/fi";
import Playlist from "./playList";

const navItems = [
  { label: "Home", icon: FiHome, active: true },
  { label: "Search", icon: FiSearch },
  { label: "Trending", icon: FiTrendingUp },
  { label: "Following", icon: FiHeart },
];

const Sidebar = () => {
  return (
    <aside className="hidden w-[240px] flex-shrink-0 flex-col gap-2 sm:flex lg:w-[280px]">
      {/* Top nav card */}
      <nav className="rounded-lg bg-panel p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <FaSpotify className="h-7 w-7 text-spotify" />
          <span className="text-lg font-bold tracking-tight">Musify</span>
        </div>
        <ul className="space-y-1">
          {navItems.map(({ label, icon: Icon, active }) => (
            <li key={label}>
              <button
                className={`flex w-full items-center gap-4 rounded-md px-2 py-2 text-sm font-semibold transition-colors duration-200 ${
                  active
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Library card */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg bg-panel">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-sm font-bold text-gray-300">Your Library</span>
          <button
            className="icon-btn"
            aria-label="Create playlist"
            title="Create playlist"
          >
            <FiPlusSquare className="h-5 w-5" />
          </button>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-2 pb-2">
          <Playlist />
        </div>

        <div className="border-t border-white/5 p-3">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-semibold text-gray-400 transition-colors duration-200 hover:text-white"
          >
            <FiLogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
