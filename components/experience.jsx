import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useShallow } from "zustand/react/shallow";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { FiAlertCircle, FiBarChart2, FiList, FiLoader, FiLock, FiSearch, FiX } from "react-icons/fi";
import Drawer from "./drawer";
import ArtistPage from "./artistPage";
import ShortcutsHelp from "./shortcutsHelp";
import PipPlayer from "./pipPlayer";
import Lyrics from "./lyrics";
import { BsPlayFill } from "react-icons/bs";
import { coverUrl, formatTime, matchesQuery } from "@/lib/playback";
import { playlistTotal } from "@/store/player";
import useSpotify from "@/hooks/useSpotify";
import usePlayback from "@/hooks/usePlayback";
import { usePlayer } from "@/store/player";
import NowPlaying from "./nowPlaying";
import Timeline from "./timeline";
import TopBar from "./topBar";
import PlaylistMenu from "./playlistMenu";

const Experience = () => {
  useSpotify(); // must run first: sets the access token the effects below rely on
  usePlayback();

  const user = useSession().data?.user;
  const token = user?.accessToken;
  const { playlist, tracks, activeIndex, status, track, isPlaying, contextUri } = usePlayer(
    useShallow((s) => ({
      playlist: s.playlist,
      tracks: s.tracks,
      activeIndex: s.activeIndex,
      status: s.status,
      track: s.track,
      isPlaying: s.isPlaying,
      contextUri: s.contextUri,
    }))
  );
  const { loadPlaylists, togglePlay, next, prev, playIndex, resumePlayback } = usePlayer.getState();
  const resume = usePlayer((s) => s.resume);
  // The full playlist object omits the count for playlists the user doesn't own; the library list has it.
  const total = usePlayer((s) => playlistTotal(s.playlists.find((p) => p.id === s.playlistId)) || playlistTotal(s.playlist));

  useEffect(() => {
    if (token) loadPlaylists(user.username);
  }, [token, user?.username, loadPlaylists]);

  const searchRef = useRef(null);
  const playlistId = usePlayer((s) => s.playlistId);
  // The query belongs to the playlist it was typed in, so a new playlist starts unfiltered
  // without an effect resetting it.
  const [search, setSearch] = useState({ playlistId: null, query: "" });
  const query = search.playlistId === playlistId ? search.query : "";
  const setQuery = (q) => setSearch({ playlistId, query: q });
  // Keep each track's index in the full list: that is what playback and highlighting use.
  const visible = useMemo(
    () => tracks.map((track, index) => ({ track, index })).filter(({ track }) => matchesQuery(track, query)),
    [tracks, query]
  );

  useEffect(() => {
    const onKey = (e) => {
      // Focused controls handle their own keys; otherwise Space on a focused button would toggle twice.
      if (e.target.closest?.("button, input, textarea, select, a, [contenteditable]")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone
      const p = usePlayer.getState();
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const handled = {
        "/": () => searchRef.current?.focus(),
        "?": () => p.toggleHelp(),
        l: () => p.toggleLyrics(),
        m: () => p.toggleMute(),
        " ": () => p.togglePlay(),
        ArrowRight: () => (e.shiftKey ? p.seekBy(10_000) : p.next()),
        ArrowLeft: () => (e.shiftKey ? p.seekBy(-10_000) : p.prev()),
        ArrowUp: () => p.nudgeVolume(0.1),
        ArrowDown: () => p.nudgeVolume(-0.1),
      }[key];
      if (!handled) return;
      e.preventDefault(); // no page scroll on Space / arrows
      handled();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A play-only playlist counts as playing only when Spotify plays from *it*; otherwise switching
  // between them would keep showing the previous playlist's track under the new title.
  const playingHere = !!track && (status !== "context" || contextUri === playlist?.uri);
  const view =
    status === "loading" || status === "idle"
      ? "status"
      : status === "context"
      ? playingHere
        ? "player"
        : "intro"
      : status === "ready" || track
      ? "player"
      : "status";

  // Show what Spotify is actually playing; before anything plays, the selected track.
  const shown = view === "player" ? track ?? tracks[activeIndex] ?? null : null;
  const backdrop = shown?.album?.images?.[0]?.url ?? (view === "intro" ? playlist?.images?.[0]?.url : null);

  return (
    // dvh: on phones the browser bars come and go; 100vh would push the timeline off screen.
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-base text-white">
      <BackdropGlow url={backdrop} />

      {/* Phones: the title takes the space between the buttons. sm+: it floats dead center. */}
      <header className="relative z-20 flex items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <PlaylistMenu />
        {/* px/py: room for script descenders and slant, which truncate would otherwise clip. */}
        <h1 className="pointer-events-none min-w-0 flex-1 truncate px-2 py-1 text-center font-script text-xl font-bold leading-normal sm:absolute sm:left-1/2 sm:max-w-[50vw] sm:-translate-x-1/2 sm:text-4xl">
          {playlist?.name ?? "Musify"}
        </h1>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {HEADER_ACTIONS.map(([view, Icon, label]) => (
            <button
              key={view}
              onClick={() => usePlayer.getState().openDrawer(view)}
              aria-label={label}
              title={label}
              className="rounded-full p-2 text-gray-300 transition-colors duration-200 hover:bg-white/10 hover:text-white"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <TopBar />
        </div>
      </header>
      <ArtistPage />
      <Drawer />
      <ShortcutsHelp />
      <PipPlayer />

      <Notice />

      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4">
        {/* One fade between views; the player keeps one key so track changes don't remount it. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view === "intro" ? `intro-${playlist?.id}` : view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full justify-center"
          >
            {view === "player" ? (
              // Desktop: lyrics open beside the player; the panel animates its own width, which glides
              // the player aside (see Lyrics).
              <div className="flex w-full items-center justify-center">
                <div className="flex w-full max-w-md justify-center">
                  <NowPlaying
                    track={shown}
                    isPlaying={isPlaying}
                    onPlayPause={togglePlay}
                    onNext={next}
                    onPrev={prev}
                    // While Spotify plays, it owns the queue (shuffle/repeat), so skipping is always allowed.
                    hasNext={!!track || activeIndex < tracks.length - 1}
                    hasPrev={!!track || activeIndex > 0}
                  />
                </div>
                <Lyrics track={shown} />
              </div>
            ) : view === "intro" ? (
              <PlayOnlyIntro
                playlist={playlist}
                // Not togglePlay: another playlist may be playing, and that would pause it.
                onPlay={resumePlayback}
                resumeTrack={resume && tracks.find((t) => t.uri === resume.uri)}
                resumeMs={resume?.positionMs}
              />
            ) : (
              <StatusMessage status={status} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="relative z-10 pb-4 pt-2 sm:pb-8">
        {status === "context" && playingHere && (
          <PlayOnlyBadge found={tracks.length} total={total} />
        )}
        {(status === "ready" || (status === "context" && tracks.length > 0)) && (
          <>
            <PlaylistSearch
              ref={searchRef}
              value={query}
              onChange={setQuery}
              count={visible.length}
              onSubmit={() => visible[0] && playIndex(visible[0].index)}
            />
            <Timeline items={visible} activeIndex={activeIndex} onSelect={playIndex} />
          </>
        )}
      </footer>
    </div>
  );
};

const HEADER_ACTIONS = [
  ["search", FiSearch, "Search Spotify"],
  ["queue", FiList, "Queue"],
  ["stats", FiBarChart2, "Your top"],
];

const PLAY_ONLY_WHY =
  "Spotify only shares the track list of playlists you own or collaborate on. You can still play this one — the timeline fills with what played and the next ~20 tracks Spotify has queued.";
const PLAY_ONLY_TIP = "Want search and the full timeline? In Spotify, select all its songs → Add to playlist → New playlist.";

// Shown instead of an empty screen when a playlist isn't the user's.
const PlayOnlyIntro = ({ playlist, onPlay, resumeTrack, resumeMs }) => {
  const cover = coverUrl(playlist?.images, 448);
  // Spotify needs a moment before it reports the new context; say so instead of looking stuck.
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    if (!starting) return;
    const id = setTimeout(() => setStarting(false), 8000); // gave up: the notice explains why
    return () => clearTimeout(id);
  }, [starting]);
  return (
    <div className="flex max-w-sm flex-col items-center px-2 text-center">
      <div className="relative h-44 w-44 overflow-hidden rounded-2xl bg-elevated shadow-2xl ring-1 ring-white/10 sm:h-56 sm:w-56">
        {cover && <Image src={cover} alt="" fill sizes="224px" className="object-cover" />}
        <span className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white backdrop-blur" aria-hidden>
          <FiLock className="h-3.5 w-3.5" />
        </span>
      </div>
      <h2 className="mt-6 text-lg font-semibold">This playlist is play-only</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">{PLAY_ONLY_WHY}</p>
      <button
        onClick={() => {
          setStarting(true);
          onPlay();
        }}
        disabled={starting}
        className="mt-6 flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-transform duration-200 hover:scale-105 disabled:scale-100 disabled:opacity-70"
      >
        {starting ? <FiLoader className="h-5 w-5 animate-spin" /> : <BsPlayFill className="h-5 w-5" />}
        {starting ? "Starting…" : resumeTrack ? "Continue" : "Play playlist"}
      </button>
      {resumeTrack && !starting && (
        <p className="mt-2 max-w-full truncate text-xs text-gray-400">
          from “{resumeTrack.name}” at {formatTime(resumeMs)}
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-gray-500">{PLAY_ONLY_TIP}</p>
    </div>
  );
};

// While a play-only playlist plays: a reminder that the timeline only holds what has played so far.
const PlayOnlyBadge = ({ found, total }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  // Close on a press anywhere outside, or Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative mx-auto mb-2 flex w-max max-w-[calc(100%-2rem)] flex-col items-center">
      <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-gray-400 ring-1 ring-white/10">
        <FiLock className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">
          Play-only · {total ? `${Math.min(found, total)} of ${total}` : found} found
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="shrink-0 text-gray-300 underline decoration-white/30 underline-offset-2 hover:text-white"
        >
          Why?
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full z-30 mb-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-elevated p-3 text-left text-xs leading-relaxed text-gray-300 shadow-2xl ring-1 ring-white/10"
          >
            <p>{PLAY_ONLY_WHY}</p>
            <p className="mt-2 text-gray-500">{PLAY_ONLY_TIP}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Same pill as "Open in Spotify". Enter plays the first match, Esc clears, "/" focuses it from anywhere.
const PlaylistSearch = forwardRef(function PlaylistSearch({ value, onChange, onSubmit, count }, ref) {
  return (
    <div className="mx-auto mb-2 flex w-[calc(100%-2rem)] max-w-xs items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm text-gray-300 ring-1 ring-white/10 transition-colors duration-200 focus-within:bg-white/10 focus-within:ring-white/25">
      <FiSearch className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        placeholder="Search this playlist"
        aria-label="Search this playlist"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          else if (e.key === "Escape") {
            onChange("");
            e.currentTarget.blur();
          }
        }}
        className="min-w-0 flex-1 bg-transparent placeholder:text-gray-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <>
          <span className="shrink-0 text-xs tabular-nums text-gray-500">{count}</span>
          <button onClick={() => onChange("")} aria-label="Clear search" className="icon-btn shrink-0">
            <FiX className="h-4 w-4" />
          </button>
        </>
      ) : (
        <kbd className="hidden shrink-0 rounded border border-white/10 px-1.5 text-[10px] text-gray-500 sm:inline">/</kbd>
      )}
    </div>
  );
});

const Notice = () => {
  const notice = usePlayer((s) => s.notice);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => usePlayer.setState({ notice: null }), 6000);
    return () => clearTimeout(id);
  }, [notice]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
      {notice && (
        <p className="pointer-events-auto max-w-md animate-[toastIn_0.2s_cubic-bezier(0.22,1,0.36,1)] rounded-xl bg-elevated/90 px-4 py-3 text-sm text-gray-200 shadow-2xl ring-1 ring-white/10 backdrop-blur">
          {notice}
        </p>
      )}
    </div>
  );
};

const StatusMessage = ({ status }) => {
  if (status === "loading" || status === "idle") {
    return (
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <FiLoader className="h-7 w-7 animate-spin" />
        <p className="text-sm">Loading your music…</p>
      </div>
    );
  }
  const messages = {
    empty:
      "No tracks here. Spotify only shares the tracks of playlists you own or collaborate on — pick one of yours from “Playlists”.",
    error:
      "Spotify wouldn’t return this playlist’s tracks. Sign out and sign in again to refresh permissions, then try another playlist.",
  };
  return (
    <div className="flex max-w-sm flex-col items-center gap-3 text-center text-gray-400">
      <FiAlertCircle className="h-7 w-7 text-gray-500" />
      <p className="text-sm">{messages[status] ?? "Something went wrong."}</p>
    </div>
  );
};

const BackdropGlow = ({ url }) => {
  if (!url) return null;
  return (
    <div
      key={url}
      className="pointer-events-none absolute inset-0 z-0 animate-[fadeIn_1.2s_ease] bg-cover bg-center opacity-20 blur-3xl saturate-150"
      style={{ backgroundImage: `url(${url})` }}
    />
  );
};

export default Experience;
