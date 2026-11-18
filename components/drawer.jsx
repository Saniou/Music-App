import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowLeft, FiPlay, FiPlus, FiSearch, FiX } from "react-icons/fi";
import { apiGet, qs } from "@/lib/api";
import { coverUrl, explainError, formatTime, normalizeTrack } from "@/lib/playback";
import { usePlayer } from "@/store/player";

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
    <p className="px-2 py-6 text-center text-sm text-gray-500">Loading…</p>
  ) : error ? (
    <p className="px-2 py-6 text-center text-sm text-gray-400">{explainError(error)}</p>
  ) : empty ? (
    <p className="px-2 py-6 text-center text-sm text-gray-500">{empty}</p>
  ) : null;

const Section = ({ title, children }) => (
  <section className="mt-5 first:mt-2">
    <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
    {children}
  </section>
);

const TrackRow = ({ track, onPlay, showQueue = true }) => {
  const addToQueue = usePlayer((s) => s.addToQueue);
  const cover = coverUrl(track.album?.images, 80);
  return (
    <div className="group flex items-center gap-3 rounded-lg p-2 transition-colors duration-200 hover:bg-hover">
      <button onClick={onPlay} className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-panel" aria-label={`Play ${track.name}`}>
        {cover && <Image src={cover} alt="" fill sizes="40px" className="object-cover" />}
        {onPlay && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <FiPlay className="h-4 w-4" />
          </span>
        )}
      </button>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-white">{track.name}</span>
        <span className="block truncate text-xs text-gray-400">{artistNames(track)}</span>
      </span>
      <span className="shrink-0 text-xs tabular-nums text-gray-500">{formatTime(track.durationMs)}</span>
      {showQueue && (
        <button onClick={() => addToQueue(track)} className="icon-btn shrink-0 p-1" aria-label={`Add ${track.name} to queue`} title="Add to queue">
          <FiPlus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

const Tile = ({ image, title, subtitle, round, onClick }) => (
  <button onClick={onClick} className="group min-w-0 rounded-lg p-2 text-left transition-colors duration-200 hover:bg-hover">
    <span className={`relative block aspect-square w-full overflow-hidden bg-panel ${round ? "rounded-full" : "rounded-md"}`}>
      {image && <Image src={image} alt="" fill sizes="120px" className="object-cover" />}
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
const openArtist = (artistId, back) => usePlayer.getState().openDrawer("artist", { artistId, back });

// Keeps the last search while the panel switches to an artist and back.
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
      <label className="mx-2 flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 focus-within:bg-white/10 focus-within:ring-white/25">
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
      </label>
      {!debounced ? (
        <Status empty="Search all of Spotify. Play a song now, queue it, or open its album or artist." />
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
                  <Tile key={a.id} round image={coverUrl(a.images, 240)} title={a.name} onClick={() => openArtist(a.id, "search")} />
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

const ARTIST_PAGE = 10; // Dev Mode max for /artists/{id}/albums

const ArtistView = ({ artistId }) => {
  const artist = useApi(`/artists/${artistId}`);
  const [pages, setPages] = useState(1);
  return (
    <>
      {artist.data && (
        <div className="flex items-center gap-4 px-2 pb-2">
          <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-panel">
            {coverUrl(artist.data.images, 160) && (
              <Image src={coverUrl(artist.data.images, 160)} alt="" fill sizes="80px" className="object-cover" />
            )}
          </span>
          <h3 className="min-w-0 truncate text-2xl font-bold">{artist.data.name}</h3>
        </div>
      )}
      <Status loading={artist.loading} error={artist.error} />
      <Section title="Discography">
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: pages }, (_, page) => (
            <AlbumPage key={page} artistId={artistId} page={page} onMore={page === pages - 1 ? () => setPages(pages + 1) : null} />
          ))}
        </div>
      </Section>
    </>
  );
};

// One page of an artist's albums; the last page offers "More" while Spotify has more.
const AlbumPage = ({ artistId, page, onMore }) => {
  const { data, error, loading } = useApi(
    `/artists/${artistId}/albums?${qs({ include_groups: "album,single", limit: ARTIST_PAGE, offset: page * ARTIST_PAGE })}`
  );
  if (loading || error)
    return (
      <div className="col-span-3">
        <Status loading={loading} error={error} />
      </div>
    );
  return (
    <>
      {(data?.items ?? []).map((a) => (
        <Tile
          key={a.id}
          image={coverUrl(a.images, 240)}
          title={a.name}
          subtitle={a.release_date?.slice(0, 4)}
          onClick={() => openAlbum(a.id)}
        />
      ))}
      {onMore && data?.next && (
        <button onClick={onMore} className="col-span-3 mt-2 rounded-full py-2 text-sm text-gray-300 ring-1 ring-white/10 hover:bg-white/5">
          More
        </button>
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
          <TrackRow track={current} showQueue={false} />
        </Section>
      )}
      {next.length > 0 && (
        <Section title="Next up">
          {next.map((t, i) => (
            <TrackRow key={`${t.uri}-${i}`} track={t} showQueue={false} />
          ))}
        </Section>
      )}
      <p className="mt-4 px-2 text-xs text-gray-500">Add songs from Search with +.</p>
    </>
  );
};

const RANGES = [
  ["short_term", "4 weeks"],
  ["medium_term", "6 months"],
  ["long_term", "All time"],
];

const StatsView = () => {
  const [range, setRange] = useState("short_term");
  const { data, error, loading } = useApi(`/me/top/artists?${qs({ time_range: range, limit: 21 })}`);
  const playTop = () => {
    usePlayer.getState().selectPlaylist(`top:${range}`);
    usePlayer.getState().closeDrawer();
  };
  return (
    <>
      <div className="mx-2 flex rounded-full bg-white/5 p-1 ring-1 ring-white/10" role="tablist">
        {RANGES.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={range === value}
            onClick={() => setRange(value)}
            className={`flex-1 rounded-full py-1.5 text-xs transition-colors ${range === value ? "bg-white text-black" : "text-gray-300 hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        onClick={playTop}
        className="mx-2 mt-3 flex w-[calc(100%-1rem)] items-center justify-center gap-2 rounded-full bg-white/10 py-2 text-sm font-medium hover:bg-white/15"
      >
        <FiPlay className="h-4 w-4" /> Open your top tracks
      </button>
      <Section title="Top artists">
        <Status loading={loading} error={error} empty={data && !data.items?.length && "Not enough listening yet."} />
        <div className="grid grid-cols-3 gap-1">
          {(data?.items ?? []).map((a, i) => (
            <Tile key={a.id} round image={coverUrl(a.images, 240)} title={`${i + 1}. ${a.name}`} onClick={() => openArtist(a.id, "stats")} />
          ))}
        </div>
      </Section>
    </>
  );
};

const TITLES = { search: "Search", queue: "Queue", artist: "Artist", stats: "Your top" };

export default function Drawer() {
  const drawer = usePlayer((s) => s.drawer);
  const { closeDrawer, openDrawer } = usePlayer.getState();

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
            onClick={closeDrawer}
            className="fixed inset-0 z-40 bg-black/40"
            aria-hidden
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-label={TITLES[drawer.view]}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="scroll-thin fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-elevated/95 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl sm:w-[400px]"
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              {drawer.back && (
                <button onClick={() => openDrawer(drawer.back)} className="icon-btn p-1" aria-label="Back">
                  <FiArrowLeft className="h-5 w-5" />
                </button>
              )}
              <h2 className="flex-1 text-lg font-semibold">{TITLES[drawer.view]}</h2>
              <button onClick={closeDrawer} className="icon-btn p-1" aria-label="Close">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            {drawer.view === "search" && <SearchView />}
            {drawer.view === "queue" && <QueueView />}
            {drawer.view === "stats" && <StatsView />}
            {drawer.view === "artist" && <ArtistView key={drawer.artistId} artistId={drawer.artistId} />}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
