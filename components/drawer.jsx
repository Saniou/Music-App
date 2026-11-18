import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { FiPlay, FiPlus, FiSearch, FiX } from "react-icons/fi";
import { apiGet, qs } from "@/lib/api";
import { coverUrl, explainError, formatTime, normalizeTrack } from "@/lib/playback";
import { readHistory, usePlayer } from "@/store/player";
import { formatListening, weekStats } from "@/lib/history";

const EASE = [0.22, 1, 0.36, 1];

// GET a Web API path; refetches when `path` or `key` changes. A null path fetches nothing.
function useApi(path, key) {
  const [state, setState] = useState({ id: null, data: null, error: null });
  const id = path && `${path}#${key ?? ""}`;
  useEffect(() => {
    if (!id) return;
    let alive = true;
    apiGet(path).then(
      (data) => alive && setState({ id, data, error: null }),
      (error) => alive && setState({ id, data: null, error })
    );
    return () => {
      alive = false;
    };
  }, [id, path]);
  const fresh = state.id === id;
  return { data: fresh ? state.data : null, error: fresh ? state.error : null, loading: !!id && !fresh };
}

const artistNames = (t) => t.artists?.map((a) => a.name).join(", ");

const Status = ({ loading, error, empty }) =>
  loading ? (
    <p className="px-2 py-8 text-center text-sm text-gray-400">Loading…</p>
  ) : error ? (
    <p className="px-2 py-8 text-center text-sm text-gray-300">{explainError(error)}</p>
  ) : empty ? (
    <p className="px-3 py-8 text-center text-sm leading-relaxed text-gray-400">{empty}</p>
  ) : null;

// Same label style as "Your Library" and the artist page.
const Section = ({ title, children }) => (
  <section className="mt-6 first:mt-3">
    <h3 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{title}</h3>
    {children}
  </section>
);

const TrackRow = ({ track, onPlay, showQueue = true, current = false }) => {
  const addToQueue = usePlayer((s) => s.addToQueue);
  const cover = coverUrl(track.album?.images, 80);
  return (
    <div className={`group flex items-center gap-3 rounded-xl p-2 transition-colors duration-200 hover:bg-white/5 ${current ? "bg-white/5" : ""}`}>
      <button
        onClick={onPlay}
        disabled={!onPlay}
        className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10"
        aria-label={`Play ${track.name}`}
      >
        {cover && <Image src={cover} alt="" fill sizes="44px" className="object-cover" />}
        {onPlay && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <FiPlay className="h-4 w-4" />
          </span>
        )}
      </button>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${current ? "text-spotify" : "text-white"}`}>{track.name}</span>
        <span className="block truncate text-xs text-gray-400">{artistNames(track)}</span>
      </span>
      <span className="shrink-0 text-xs tabular-nums text-gray-500">{formatTime(track.durationMs)}</span>
      {showQueue && (
        <button
          onClick={() => addToQueue(track)}
          className="shrink-0 rounded-full p-1.5 text-gray-400 opacity-60 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
          aria-label={`Add ${track.name} to queue`}
          title="Add to queue"
        >
          <FiPlus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

const Tile = ({ image, title, subtitle, round, onClick }) => (
  <button onClick={onClick} className="group min-w-0 rounded-xl p-2 text-left transition-colors duration-200 hover:bg-white/5">
    <span
      className={`relative block aspect-square w-full overflow-hidden bg-white/5 shadow-lg ring-1 ring-white/10 ${round ? "rounded-full" : "rounded-lg"}`}
    >
      {image && <Image src={image} alt="" fill sizes="120px" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
    </span>
    <span className="mt-2 block truncate text-sm text-white">{title}</span>
    {subtitle && <span className="block truncate text-xs text-gray-400">{subtitle}</span>}
  </button>
);

const openAlbum = (id) => {
  const { selectPlaylist, closeDrawer } = usePlayer.getState();
  selectPlaylist(`album:${id}`);
  closeDrawer();
};
const openArtist = (id) => usePlayer.getState().openArtist(id);

// The same pill as "Search this playlist".
const Pill = ({ children }) => (
  <label className="mx-1 flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 transition-colors duration-200 focus-within:bg-white/10 focus-within:ring-white/25">
    {children}
  </label>
);

// Keeps the last search while the panel closes and reopens.
const searchCache = { q: "" };

const SearchView = () => {
  const [q, setQ] = useState(searchCache.q);
  const [debounced, setDebounced] = useState(searchCache.q.trim());
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  // Dev Mode caps search at 10 results per type.
  const { data, error, loading } = useApi(debounced ? `/search?${qs({ q: debounced, type: "track,album,artist", limit: 10 })}` : null);
  const tracks = (data?.tracks?.items ?? []).map(normalizeTrack).filter(Boolean);
  const albums = data?.albums?.items ?? [];
  const artists = data?.artists?.items ?? [];
  const playTracks = usePlayer((s) => s.playTracks);

  return (
    <>
      <Pill>
        <FiSearch className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ((searchCache.q = e.target.value))}
          placeholder="Songs, albums, artists"
          aria-label="Search Spotify"
          className="min-w-0 flex-1 bg-transparent text-white placeholder:text-gray-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button onClick={() => setQ((searchCache.q = ""))} className="icon-btn shrink-0" aria-label="Clear search">
            <FiX className="h-4 w-4" />
          </button>
        )}
      </Pill>
      {!debounced ? (
        <Status empty="Search all of Spotify. Play a song, queue it, or open its album or artist." />
      ) : (
        <>
          <Status loading={loading} error={error} empty={data && !tracks.length && !albums.length && !artists.length && "Nothing found."} />
          {tracks.length > 0 && (
            <Section title="Songs">
              {tracks.map((t, i) => (
                <TrackRow key={t.uri} track={t} onPlay={() => playTracks(tracks, i)} />
              ))}
            </Section>
          )}
          {artists.length > 0 && (
            <Section title="Artists">
              <div className="grid grid-cols-3 gap-1">
                {artists.map((a) => (
                  <Tile key={a.id} round image={coverUrl(a.images, 240)} title={a.name} onClick={() => openArtist(a.id)} />
                ))}
              </div>
            </Section>
          )}
          {albums.length > 0 && (
            <Section title="Albums">
              <div className="grid grid-cols-3 gap-1">
                {albums.map((a) => (
                  <Tile key={a.id} image={coverUrl(a.images, 240)} title={a.name} subtitle={artistNames(a)} onClick={() => openAlbum(a.id)} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </>
  );
};

const QueueView = () => {
  const uri = usePlayer((s) => s.track?.uri);
  const { data, error, loading } = useApi("/me/player/queue", uri); // refetch when the track changes
  const current = data?.currently_playing && normalizeTrack(data.currently_playing);
  const next = (data?.queue ?? []).map(normalizeTrack).filter(Boolean);
  return (
    <>
      <Status loading={loading} error={error} empty={data && !current && "Nothing is playing."} />
      {current && (
        <Section title="Now playing">
          <TrackRow track={current} showQueue={false} current />
        </Section>
      )}
      {next.length > 0 && (
        <Section title="Next up">
          {next.map((t, i) => (
            <TrackRow key={`${t.uri}-${i}`} track={t} showQueue={false} />
          ))}
        </Section>
      )}
      {data && <p className="mt-6 px-2 text-xs text-gray-500">Add songs from Search with +.</p>}
    </>
  );
};

const RANGES = [
  ["short_term", "4 weeks"],
  ["medium_term", "6 months"],
  ["long_term", "All time"],
];

// "Your week" from our own log: a headline number, minutes per day, top artists and songs.
const YourWeek = () => {
  const userId = usePlayer((s) => s.userId);
  const uri = usePlayer((s) => s.track?.uri); // re-read as songs change, so a just-finished one shows
  // eslint-disable-next-line react-hooks/exhaustive-deps -- uri is the refresh signal, not an input
  const stats = useMemo(() => weekStats(readHistory(userId)), [userId, uri]);
  const max = Math.max(1, ...stats.days.map((d) => d.ms));
  const today = stats.days.length - 1;

  if (!stats.plays)
    return (
      <Status empty="Your own stats start now: every song you listen to for 30 seconds or more is counted. They stay in this browser only." />
    );

  return (
    <>
      <div className="mx-1 mt-1 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Listened</p>
          <p className="mt-1 text-2xl font-bold">{formatListening(stats.totalMs)}</p>
        </div>
        <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Plays</p>
          <p className="mt-1 text-2xl font-bold">{stats.plays}</p>
        </div>
      </div>

      <Section title="Minutes per day">
        {/* One series, one colour; today in full strength. Hover or focus a day for its value. */}
        <div className="mx-1 flex h-36 items-end gap-2 border-b border-white/10 pt-8" role="list" aria-label="Minutes listened per day, last 7 days">
          {stats.days.map((d, i) => {
            const minutes = Math.round(d.ms / 60_000);
            const day = new Date(d.start).toLocaleDateString(undefined, { weekday: "short" });
            return (
              <div
                key={d.start}
                role="listitem"
                tabIndex={0}
                aria-label={`${day}: ${minutes} minutes`}
                className="group relative flex h-full flex-1 flex-col justify-end outline-none"
              >
                <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {day} · {minutes} min
                </span>
                <div
                  className={`w-full rounded-t-[4px] transition-colors ${i === today ? "bg-spotify" : "bg-spotify/50 group-hover:bg-spotify/70"}`}
                  style={{ height: d.ms ? `max(3px, ${(d.ms / max) * 100}%)` : 0 }}
                />
              </div>
            );
          })}
        </div>
        <div className="mx-1 mt-1.5 flex gap-2">
          {stats.days.map((d, i) => (
            <span key={d.start} className={`flex-1 text-center text-[11px] ${i === today ? "font-semibold text-white" : "text-gray-500"}`}>
              {new Date(d.start).toLocaleDateString(undefined, { weekday: "narrow" })}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Top artists">
        {stats.topArtists.map((a, i) => (
          <button
            key={a.id ?? a.name}
            onClick={() => a.id && openArtist(a.id)}
            disabled={!a.id}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/5"
          >
            <span className="w-5 text-right text-sm tabular-nums text-gray-500">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
            <span className="text-xs tabular-nums text-gray-400">{formatListening(a.ms)}</span>
          </button>
        ))}
      </Section>

      <Section title="Top songs">
        {stats.topTracks.map((t) => (
          <div key={t.uri} className="flex items-center gap-3 rounded-xl p-2">
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
              {t.cover && <Image src={t.cover} alt="" fill sizes="40px" className="object-cover" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{t.name}</span>
              <span className="block truncate text-xs text-gray-400">{t.artists?.map((a) => a.name).join(", ")}</span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-gray-400">{t.plays}×</span>
          </div>
        ))}
      </Section>
      <p className="mt-4 px-2 text-xs text-gray-500">Counted in this browser; songs played 30 seconds or more.</p>
    </>
  );
};

const StatsView = () => {
  const [source, setSource] = useState("spotify");
  return (
    <>
      <div className="mx-1 mb-3 flex rounded-full bg-white/5 p-1 ring-1 ring-white/10" role="tablist" aria-label="Stats source">
        {[
          ["spotify", "Spotify top"],
          ["week", "Your week"],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={source === value}
            onClick={() => setSource(value)}
            className={`flex-1 rounded-full py-1.5 text-xs transition-colors duration-200 ${
              source === value ? "bg-white/15 text-white shadow-sm" : "text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {source === "spotify" ? <SpotifyTop /> : <YourWeek />}
    </>
  );
};

const SpotifyTop = () => {
  const [range, setRange] = useState("short_term");
  const { data, error, loading } = useApi(`/me/top/artists?${qs({ time_range: range, limit: 21 })}`);
  const playTop = () => {
    usePlayer.getState().selectPlaylist(`top:${range}`);
    usePlayer.getState().closeDrawer();
  };
  return (
    <>
      <div className="mx-1 flex rounded-full bg-white/5 p-1 ring-1 ring-white/10" role="tablist">
        {RANGES.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={range === value}
            onClick={() => setRange(value)}
            className={`flex-1 rounded-full py-1.5 text-xs transition-colors duration-200 ${
              range === value ? "bg-white/15 text-white shadow-sm" : "text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        onClick={playTop}
        className="mx-1 mt-3 flex w-[calc(100%-0.5rem)] items-center justify-center gap-2 rounded-full bg-white/5 py-2 text-sm text-gray-200 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
      >
        <FiPlay className="h-4 w-4" /> Open your top tracks
      </button>
      <Section title="Top artists">
        <Status loading={loading} error={error} empty={data && !data.items?.length && "Not enough listening yet."} />
        <div className="grid grid-cols-3 gap-1">
          {(data?.items ?? []).map((a, i) => (
            <Tile key={a.id} round image={coverUrl(a.images, 240)} title={a.name} subtitle={`#${i + 1}`} onClick={() => openArtist(a.id)} />
          ))}
        </div>
      </Section>
    </>
  );
};

const TITLES = { search: "Search", queue: "Queue", stats: "Your top" };

// Right side panel. Glass over the page, tinted by the playing cover (content is the colour),
// floating with rounded corners on wide screens, full screen on phones.
export default function Drawer() {
  const drawer = usePlayer((s) => s.drawer);
  const tint = usePlayer((s) => coverUrl(s.track?.album?.images, 300));
  const { closeDrawer } = usePlayer.getState();

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e) => e.key === "Escape" && closeDrawer();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, closeDrawer]);

  return (
    <AnimatePresence>
      {drawer && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            onClick={closeDrawer}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            aria-hidden
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-label={TITLES[drawer.view]}
            initial={{ x: "105%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "105%", opacity: 0.6 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden bg-black/45 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl sm:inset-y-3 sm:right-3 sm:w-[400px] sm:rounded-[20px]"
          >
            {tint && (
              <div
                className="pointer-events-none absolute -inset-10 bg-cover bg-center opacity-30 blur-3xl saturate-150"
                style={{ backgroundImage: `url(${tint})` }}
              />
            )}
            <header className="relative flex items-center gap-2 px-4 pb-2 pt-4">
              <h2 className="flex-1 pb-1 font-script text-3xl font-bold leading-normal">{TITLES[drawer.view]}</h2>
              <button onClick={closeDrawer} className="rounded-full p-2 text-gray-300 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close">
                <FiX className="h-5 w-5" />
              </button>
            </header>
            <div className="scroll-thin relative min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              {drawer.view === "search" && <SearchView />}
              {drawer.view === "queue" && <QueueView />}
              {drawer.view === "stats" && <StatsView />}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
