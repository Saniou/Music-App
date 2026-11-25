import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowLeft, FiExternalLink } from "react-icons/fi";
import { BsPauseFill, BsPlayFill } from "react-icons/bs";
import { apiGet, qs } from "@/lib/api";
import { coverUrl, explainError, formatTime, normalizeTrack } from "@/lib/playback";
import { artistBundle, formatFans, groupAlbums, pickArtist, playingRow, songCore, wikiSummary } from "@/lib/artistInfo";
import { usePlayer } from "@/store/player";
import { useShallow } from "zustand/react/shallow";
import Equalizer, { Loader } from "./equalizer";

const EASE = [0.22, 1, 0.36, 1];
// Two fades multiplied (mask-composite: intersect): towards the left and towards the bottom.
const HERO_MASK = "linear-gradient(to left, #000 55%, transparent 100%), linear-gradient(to bottom, #000 50%, transparent 100%)";
const GRID_PREVIEW = 12; // albums shown before "Show all"
const PILL =
  "rounded-full bg-white/5 px-4 py-2 text-sm text-gray-300 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white";

// Run an async loader keyed by `key`; `retry()` runs it again. A null key loads nothing.
function useAsync(key, load) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ id: null, data: null, error: null });
  const id = key && `${key}#${attempt}`;
  useEffect(() => {
    if (!id) return;
    let alive = true;
    load().then(
      (data) => alive && setState({ id, data, error: null }),
      (error) => alive && setState({ id, data: null, error })
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` identifies the load
  }, [id]);
  const fresh = state.id === id;
  return { data: fresh ? state.data : null, error: fresh ? state.error : null, loading: !!id && !fresh, retry: () => setAttempt((n) => n + 1) };
}

// The page's data comes from Deezer and Wikipedia; Spotify is asked only to play or open something,
// with one search per click (results remembered for the session).
const spotifyFinds = new Map();
function findOnSpotify(type, q) {
  const key = `${type}|${q}`;
  if (!spotifyFinds.has(key))
    spotifyFinds.set(
      key,
      apiGet(`/search?${qs({ q, type, limit: type === "artist" ? 5 : 1 })}`).catch((e) => {
        spotifyFinds.delete(key);
        throw e;
      })
    );
  return spotifyFinds.get(key);
}

const notify = (notice) => usePlayer.setState({ notice });
const quoted = (s) => `"${String(s).replace(/"/g, "")}"`;

async function playSong(title, artistName, artistId) {
  try {
    const data = await findOnSpotify("track", `track:${quoted(title)} artist:${quoted(artistName)}`);
    const track = normalizeTrack(data?.tracks?.items?.[0]);
    if (!track) return notify(`Couldn’t find “${title}” on Spotify.`);
    usePlayer.getState().playTracks([track], 0, { label: artistName, artistId, artistName });
  } catch (e) {
    notify(explainError(e));
  }
}

async function openAlbum(title, artistName) {
  try {
    const data = await findOnSpotify("album", `album:${quoted(title)} artist:${quoted(artistName)}`);
    const album = data?.albums?.items?.[0];
    if (!album) return notify(`Couldn’t find “${title}” on Spotify.`);
    const { selectPlaylist, closeArtist } = usePlayer.getState();
    selectPlaylist(`album:${album.id}`);
    closeArtist();
  } catch (e) {
    notify(explainError(e));
  }
}

async function openRelated(name) {
  try {
    const data = await findOnSpotify("artist", `artist:${quoted(name)}`);
    const artist = pickArtist(data?.artists?.items ?? [], name);
    if (!artist) return notify(`Couldn’t find ${name} on Spotify.`);
    usePlayer.getState().openArtist(artist.id, artist.name);
  } catch (e) {
    notify(explainError(e));
  }
}

const SectionTitle = ({ children }) => (
  <h2 className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{children}</h2>
);

// What's playing now, for marking it on the page (Deezer and Spotify spell titles a bit differently;
// songCore / playingRow line them up without merging versions like "(Slowed)").
const useNowPlaying = () =>
  usePlayer(
    useShallow((s) => ({
      name: s.track?.name,
      durationMs: s.track?.durationMs ?? s.durationMs,
      album: songCore(s.track?.album?.name),
      isPlaying: s.isPlaying,
    }))
  );

const Popular = ({ tracks, artistName, artistId }) => {
  const now = useNowPlaying();
  const playingIndex = playingRow(tracks, now); // at most one row
  return (
    <section className="mt-10">
      <SectionTitle>Popular</SectionTitle>
      <ol className="grid gap-x-6 lg:grid-cols-2">
        {tracks.map((t, i) => {
          const playing = i === playingIndex;
          return (
            <li key={t.id}>
              <button
                onClick={() => (playing ? usePlayer.getState().togglePlay() : playSong(t.title, artistName, artistId))}
                aria-current={playing || undefined}
                className={`group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/5 ${playing ? "bg-white/5" : ""}`}
              >
                <span className="flex w-5 justify-end text-sm tabular-nums text-gray-500">
                  {playing ? (
                    <Equalizer className="h-3.5 w-3.5 text-spotify" playing={now.isPlaying} />
                  ) : (
                    <>
                      <span className="group-hover:hidden">{i + 1}</span>
                      <BsPlayFill className="hidden h-5 w-5 text-white group-hover:block" aria-hidden />
                    </>
                  )}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element -- Deezer CDN image, already sized */}
                <img src={t.album?.cover_small} alt="" className="h-10 w-10 shrink-0 rounded-md bg-white/5 object-cover" loading="lazy" />
                <span className={`min-w-0 flex-1 truncate text-sm ${playing ? "text-spotify" : ""}`}>{t.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-400">{formatTime(t.duration * 1000)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

const AlbumGrid = ({ title, albums, artistName }) => {
  const [all, setAll] = useState(false);
  const now = useNowPlaying();
  if (!albums.length) return null;
  const shown = all ? albums : albums.slice(0, GRID_PREVIEW);
  return (
    <section className="mt-10">
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {shown.map((a, i) => {
          const playing = !!now.album && songCore(a.title) === now.album;
          return (
          <motion.button
            key={a.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: Math.min(i, 12) * 0.03 }}
            onClick={() => openAlbum(a.title, artistName)}
            aria-current={playing || undefined}
            className="group min-w-0 rounded-2xl p-2 text-left transition-colors duration-200 hover:bg-white/5"
          >
            <span
              className={`relative block aspect-square w-full overflow-hidden rounded-xl bg-white/5 shadow-lg ring-1 ${
                playing ? "ring-2 ring-spotify" : "ring-white/10"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Deezer CDN image, already sized */}
              <img src={a.cover_big ?? a.cover_medium} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              {playing && (
                <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 backdrop-blur">
                  <Equalizer className="h-3.5 w-3.5 text-spotify" playing={now.isPlaying} />
                </span>
              )}
            </span>
            <span className={`mt-2 block truncate text-sm font-medium ${playing ? "text-spotify" : "text-white"}`}>{a.title}</span>
            <span className="block truncate text-xs capitalize text-gray-400">
              {[a.release_date?.slice(0, 4), a.record_type === "compile" ? "compilation" : a.record_type].filter(Boolean).join(" · ")}
            </span>
          </motion.button>
          );
        })}
      </div>
      {albums.length > GRID_PREVIEW && (
        <div className="px-2 pt-2">
          <button onClick={() => setAll(!all)} className={PILL}>
            {all ? "Show less" : `Show all ${albums.length}`}
          </button>
        </div>
      )}
    </section>
  );
};

const Related = ({ artists }) =>
  artists.length ? (
    <section className="mt-10">
      <SectionTitle>Fans also like</SectionTitle>
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6">
        {artists.map((a) => (
          <button key={a.id} onClick={() => openRelated(a.name)} className="group min-w-0 rounded-2xl p-2 text-center transition-colors hover:bg-white/5">
            <span className="relative mx-auto block aspect-square w-full overflow-hidden rounded-full bg-white/5 shadow-lg ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element -- Deezer CDN image, already sized */}
              <img src={a.picture_medium} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </span>
            <span className="mt-2 block truncate text-sm">{a.name}</span>
            {!!a.nb_fan && <span className="block truncate text-xs text-gray-500">{formatFans(a.nb_fan)}</span>}
          </button>
        ))}
      </div>
    </section>
  ) : null;

const About = ({ wiki }) =>
  wiki ? (
    <section className="mt-10 max-w-3xl">
      <SectionTitle>About</SectionTitle>
      <div className="mx-2 rounded-[20px] bg-black/30 p-5 ring-1 ring-white/10 backdrop-blur-xl glass-panel">
        {wiki.description && <p className="mb-2 text-xs uppercase tracking-[0.18em] text-gray-400">{wiki.description}</p>}
        <p className="text-sm leading-relaxed text-gray-200">{wiki.extract}</p>
        {wiki.url && (
          <a href={wiki.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
            Read more on Wikipedia <FiExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </section>
  ) : null;

// Bottom pill: what's playing, so the music stays at hand; a click goes back to the player.
const MiniPlayer = () => {
  const track = usePlayer((s) => s.track);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const { togglePlay, closeArtist } = usePlayer.getState();
  if (!track) return null;
  const cover = coverUrl(track.album?.images, 80);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-full bg-black/50 p-1.5 pr-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl glass-panel">
        <button onClick={closeArtist} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Back to the player">
          {/* eslint-disable-next-line @next/next/no-img-element -- small Spotify CDN thumbnail */}
          {cover ? <img src={cover} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <span className="h-9 w-9 shrink-0 rounded-full bg-white/5" />}
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
  const name = usePlayer((s) => s.artistName);
  const bundle = useAsync(name && `deezer:${name}`, () => artistBundle(name));
  const wiki = useAsync(name && `wiki:${name}`, () => wikiSummary(name));
  const { closeArtist, playUri } = usePlayer.getState();
  // Playing the artist is a Spotify command built from the id: no lookup needed.
  const artistUri = `spotify:artist:${artistId}`;
  const playingThis = usePlayer((s) => s.contextUri === artistUri && s.isPlaying);
  const info = bundle.data;
  const image = info?.artist?.picture_xl ?? info?.artist?.picture_big;
  const { albums, singles } = groupAlbums(info?.albums ?? []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="scroll-thin fixed inset-0 z-30 overflow-y-auto bg-base text-white"
      role="dialog"
      aria-label={name ?? "Artist"}
    >
      {/* Content is the colour: the artist photo tints the whole page. */}
      {image && (
        <div className="pointer-events-none fixed inset-0 scale-110 bg-cover bg-center opacity-30 blur-3xl saturate-150 cover-glow" style={{ backgroundImage: `url(${image})` }} />
      )}

      <button
        onClick={closeArtist}
        className="fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-20 flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-sm text-gray-200 ring-1 ring-white/10 backdrop-blur-xl glass-panel transition-colors hover:bg-black/60 hover:text-white sm:left-6 sm:top-[max(1.25rem,env(safe-area-inset-top))]"
        aria-label="Back"
      >
        <FiArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back</span>
      </button>

      {/* Hero: the square photo at the right of the content column, fading left (where the name sits)
          and down into the page's tint: a mask, not a fill, so there's no seam. */}
      <header className="relative h-[46vh] min-h-[320px] w-full overflow-hidden">
        <div className="absolute inset-0 mx-auto max-w-6xl">
          {image && (
            <motion.div
              key={image}
              initial={{ scale: 1.06, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: EASE }}
              className="absolute inset-y-0 right-0 aspect-square h-full max-w-full"
              style={{ WebkitMaskImage: HERO_MASK, maskImage: HERO_MASK, WebkitMaskComposite: "source-in", maskComposite: "intersect" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Deezer CDN, 1000px */}
              <img src={image} alt="" className="h-full w-full object-cover object-top" />
            </motion.div>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-6xl items-end justify-between gap-4 px-4 pb-6 sm:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-300">Artist</p>
            {/* Script descenders and the slant overhang the line box; truncate clips them without padding. */}
            <h1 className="truncate pb-3 pr-3 font-script text-5xl font-bold leading-normal drop-shadow-lg sm:text-7xl">{name}</h1>
            {!!info?.artist?.nb_fan && <p className="truncate text-sm text-gray-300">{formatFans(info.artist.nb_fan)}</p>}
          </div>
          <button
            onClick={() => (playingThis ? usePlayer.getState().togglePlay() : playUri(artistUri, { label: name, artistId, artistName: name }))}
            aria-label={playingThis ? "Pause" : `Play ${name ?? "artist"}`}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-2xl transition-transform hover:scale-105"
          >
            {playingThis ? <BsPauseFill className="h-7 w-7" /> : <BsPlayFill className="ml-1 h-7 w-7" />}
          </button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-2 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6">
        {bundle.loading ? (
          <Loader text="Loading artist…" className="pt-14" />
        ) : bundle.error ? (
          <div className="flex items-center gap-3 px-2 pt-10">
            <p className="text-sm text-gray-400">Couldn’t load this artist’s details.</p>
            <button onClick={bundle.retry} className={PILL}>
              Try again
            </button>
          </div>
        ) : !info ? (
          <p className="px-2 pt-10 text-sm text-gray-400">No details found for this artist. The play button still works.</p>
        ) : (
          <>
            {!!info.top.length && <Popular tracks={info.top} artistName={name} artistId={artistId} />}
            <AlbumGrid title="Albums" albums={albums} artistName={name} />
            <AlbumGrid title="Singles & EPs" albums={singles} artistName={name} />
            <Related artists={info.related} />
          </>
        )}
        <About wiki={wiki.data} />
        <p className="mt-10 px-2 text-[11px] text-gray-600">Artist details: Deezer · Wikipedia</p>
      </main>

      <MiniPlayer />
    </motion.div>
  );
};

export default function ArtistPage() {
  const artistId = usePlayer((s) => s.artistId);

  // Browser Back closes the page; Esc too.
  useEffect(() => {
    const onPop = () =>
      usePlayer.setState({ artistId: history.state?.artistId ?? null, artistName: history.state?.artistName ?? null });
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
