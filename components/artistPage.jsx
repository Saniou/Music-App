import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowLeft } from "react-icons/fi";
import { BsPauseFill, BsPlayFill } from "react-icons/bs";
import { apiGet, isRateLimited, qs } from "@/lib/api";
import { coverUrl, explainError } from "@/lib/playback";
import { usePlayer } from "@/store/player";

const EASE = [0.22, 1, 0.36, 1];
// Two fades multiplied (mask-composite: intersect): towards the left and towards the bottom.
const HERO_MASK = "linear-gradient(to left, #000 55%, transparent 100%), linear-gradient(to bottom, #000 50%, transparent 100%)";
const PAGE = 10; // Dev Mode max for /artists/{id}/albums

// [include_groups, title]: Spotify splits a discography into these.
const SECTIONS = [
  ["album", "Albums"],
  ["single", "Singles & EPs"],
  ["appears_on", "Appears on"],
];

// GET with a manual retry: `retry()` refetches after a failure. A null path fetches nothing yet.
function useFetch(path) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ id: null, data: null, error: null });
  const id = path && `${path}#${attempt}`;
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
  return {
    data: fresh ? state.data : null,
    error: fresh ? state.error : null,
    loading: !!id && !fresh,
    retry: () => setAttempt((n) => n + 1),
  };
}

// True once `ref` comes within `margin` of the viewport; stays true. Lets sections below the fold
// wait for a scroll before spending requests.
function useNearViewport(ref, eager) {
  const [near, setNear] = useState(eager);
  useEffect(() => {
    if (near || !ref.current) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { rootMargin: "300px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [near, ref]);
  return near;
}

const AlbumCard = ({ album, index }) => {
  const openAlbum = () => {
    const { selectPlaylist, closeArtist } = usePlayer.getState();
    selectPlaylist(`album:${album.id}`);
    closeArtist();
  };
  const cover = coverUrl(album.images, 300);
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: Math.min(index, 10) * 0.03 }}
      onClick={openAlbum}
      className="group min-w-0 rounded-2xl p-2 text-left transition-colors duration-200 hover:bg-white/5"
    >
      <span className="relative block aspect-square w-full overflow-hidden rounded-xl bg-white/5 shadow-lg ring-1 ring-white/10">
        {cover && (
          <Image src={cover} alt="" fill sizes="200px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        )}
      </span>
      <span className="mt-2 block truncate text-sm font-medium text-white">{album.name}</span>
      <span className="block truncate text-xs text-gray-400">
        {[album.release_date?.slice(0, 4), album.total_tracks > 1 ? `${album.total_tracks} songs` : null].filter(Boolean).join(" · ")}
      </span>
    </motion.button>
  );
};

const albumsPath = (artistId, group, page) =>
  `/artists/${artistId}/albums?${qs({ include_groups: group, limit: PAGE, offset: page * PAGE })}`;

// Pages after the first: each fetches its 10 albums; the last one offers "More" while Spotify has more.
const MorePage = ({ artistId, group, page, isLast, onMore }) => {
  const fetched = useFetch(albumsPath(artistId, group, page));
  return (
    <>
      {(fetched.data?.items ?? []).map((album, i) => (
        <AlbumCard key={album.id} album={album} index={i} />
      ))}
      <MoreButton {...fetched} show={isLast} onMore={onMore} />
    </>
  );
};

const PILL =
  "rounded-full bg-white/5 px-4 py-2 text-sm text-gray-300 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white";

const MoreButton = ({ data, error, loading, retry, show, onMore }) =>
  error ? (
    <div className="col-span-full flex items-center gap-3 px-2 py-2">
      <p className="text-sm text-gray-400">{explainError(error)}</p>
      <button onClick={retry} className={PILL}>
        Try again
      </button>
    </div>
  ) : loading ? (
    <p className="col-span-full px-2 py-4 text-sm text-gray-500">
      {/* While Spotify's rate limit runs out, say so instead of looking stuck. */}
      {isRateLimited() ? "Waiting for Spotify…" : "Loading…"}
    </p>
  ) : show && data?.next ? (
    <div className="col-span-full px-2 pt-2">
      <button onClick={onMore} className={PILL}>
        More
      </button>
    </div>
  ) : null;

// One discography section; hidden when the artist has nothing in it. Below-the-fold sections fetch
// only when scrolled near, so opening an artist costs 2 requests (photo + albums), not 4.
const Section = ({ artistId, group, title, eager = false }) => {
  const [pages, setPages] = useState(1);
  const ref = useRef(null);
  const near = useNearViewport(ref, eager);
  const first = useFetch(near ? albumsPath(artistId, group, 0) : null);
  if (near && !first.loading && !first.error && !first.data?.items?.length) return null;
  const more = () => setPages(pages + 1);
  if (!near) return <div ref={ref} className="h-40" aria-hidden />; // placeholder the observer watches
  return (
    <section className="mt-10">
      <h2 className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{title}</h2>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {(first.data?.items ?? []).map((album, i) => (
          <AlbumCard key={album.id} album={album} index={i} />
        ))}
        <MoreButton {...first} show={pages === 1} onMore={more} />
        {Array.from({ length: pages - 1 }, (_, i) => (
          <MorePage key={i + 1} artistId={artistId} group={group} page={i + 1} isLast={i + 2 === pages} onMore={more} />
        ))}
      </div>
    </section>
  );
};

// Bottom pill: what's playing, so the music stays at hand; a click goes back to the player.
const MiniPlayer = () => {
  const track = usePlayer((s) => s.track);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const { togglePlay, closeArtist } = usePlayer.getState();
  if (!track) return null;
  const cover = coverUrl(track.album?.images, 80);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-full bg-black/50 p-1.5 pr-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
        <button onClick={closeArtist} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Back to the player">
          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/5">
            {cover && <Image src={cover} alt="" fill sizes="36px" className="object-cover" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{track.name}</span>
            <span className="block truncate text-xs text-gray-400">{track.artists?.map((a) => a.name).join(", ")}</span>
          </span>
        </button>
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
        >
          {isPlaying ? <BsPauseFill className="h-5 w-5" /> : <BsPlayFill className="ml-0.5 h-5 w-5" />}
        </button>
      </div>
    </div>
  );
};

const Page = ({ artistId }) => {
  const { data: artist, error, loading } = useFetch(`/artists/${artistId}`);
  const { closeArtist, playUri } = usePlayer.getState();
  const playingThis = usePlayer((s) => s.contextUri && s.contextUri === artist?.uri && s.isPlaying);
  const image = coverUrl(artist?.images, 640);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="scroll-thin fixed inset-0 z-30 overflow-y-auto bg-base text-white"
      role="dialog"
      aria-label={artist?.name ?? "Artist"}
    >
      {/* Content is the colour: the artist photo tints the whole page. */}
      {image && (
        <div
          className="pointer-events-none fixed inset-0 scale-110 bg-cover bg-center opacity-30 blur-3xl saturate-150"
          style={{ backgroundImage: `url(${image})` }}
        />
      )}

      <button
        onClick={closeArtist}
        className="fixed left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-sm text-gray-200 ring-1 ring-white/10 backdrop-blur-xl transition-colors hover:bg-black/60 hover:text-white sm:left-6 sm:top-5"
        aria-label="Back"
      >
        <FiArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back</span>
      </button>

      {/* Hero. Spotify's artist photos are square and at most 640px, so stretching one across the page
          blurred and cropped it. It stays square at the right, fading left (where the name sits) and
          down straight into the page's tint: a mask, not a fill, so there's no seam. */}
      <header className="relative h-[46vh] min-h-[320px] w-full overflow-hidden">
        {/* The photo sits in the same centered column as the name and the albums, at its right edge,
            so the hero reads as one composition instead of a picture stuck to the window's edge. */}
        <div className="absolute inset-0 mx-auto max-w-6xl">
          {image && (
            <motion.div
              initial={{ scale: 1.06, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: EASE }}
              className="absolute inset-y-0 right-0 aspect-square h-full max-w-full"
              style={{ WebkitMaskImage: HERO_MASK, maskImage: HERO_MASK, WebkitMaskComposite: "source-in", maskComposite: "intersect" }}
            >
              <Image src={image} alt="" fill sizes="(min-width: 640px) 46vh, 100vw" priority className="object-cover object-top" />
            </motion.div>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-6xl items-end justify-between gap-4 px-4 pb-6 sm:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-300">Artist</p>
            {/* Script descenders and the slant overhang the line box; truncate clips them without
                the bottom/right padding. */}
            <h1 className="truncate pb-3 pr-3 font-script text-5xl font-bold leading-normal drop-shadow-lg sm:text-7xl">
              {artist?.name ?? (loading ? " " : "")}
            </h1>
            {!!artist?.genres?.length && <p className="mt-1 truncate text-sm text-gray-300">{artist.genres.slice(0, 3).join(" · ")}</p>}
          </div>
          {artist?.uri && (
            <button
              onClick={() => (playingThis ? usePlayer.getState().togglePlay() : playUri(artist.uri))}
              aria-label={playingThis ? "Pause" : `Play ${artist.name}`}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-2xl transition-transform hover:scale-105"
            >
              {playingThis ? <BsPauseFill className="h-7 w-7" /> : <BsPlayFill className="ml-1 h-7 w-7" />}
            </button>
          )}
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-2 pb-28 sm:px-6">
        {error && <p className="px-2 pt-6 text-sm text-gray-400">{explainError(error)}</p>}
        {SECTIONS.map(([group, title], i) => (
          <Section key={group} artistId={artistId} group={group} title={title} eager={i === 0} />
        ))}
      </main>

      <MiniPlayer />
    </motion.div>
  );
};

export default function ArtistPage() {
  const artistId = usePlayer((s) => s.artistId);

  // Browser Back closes the page; Esc too.
  useEffect(() => {
    const onPop = () => usePlayer.setState({ artistId: history.state?.artistId ?? null });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (!artistId) return;
    const onKey = (e) => e.key === "Escape" && !usePlayer.getState().drawer && usePlayer.getState().closeArtist();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [artistId]);

  return <AnimatePresence>{artistId && <Page key={artistId} artistId={artistId} />}</AnimatePresence>;
}
