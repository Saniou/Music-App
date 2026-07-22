import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { FiChevronDown, FiLogOut } from "react-icons/fi";

const TopBar = () => {
  const { data: session } = useSession();
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
        <span className="text-sm font-semibold">{name}</span>
        <FiChevronDown
          className={`h-4 w-4 text-gray-300 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-md bg-elevated shadow-xl ring-1 ring-white/10">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-gray-200 transition-colors duration-200 hover:bg-hover"
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
