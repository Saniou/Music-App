import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRecoilValue, useRecoilState } from "recoil";
import { FiClock } from "react-icons/fi";
import { playlistIdState, playlistState } from "@/atoms/playlistAtoms";
import useSpotify from "@/hooks/useSpotify";
import { decodeHtml } from "@/lib/decode";
import Songs from "./songs";
import TopBar from "./topBar";

// Deterministic gradient per playlist so it doesn't flicker on every render.
const gradients = [
  "from-rose-700",
  "from-indigo-700",
  "from-emerald-700",
  "from-orange-700",
  "from-sky-700",
  "from-violet-700",
  "from-red-700",
  "from-teal-700",
  "from-fuchsia-700",
  "from-amber-700",
];

const hashToIndex = (str, len) => {
  let hash = 0;
  for (let i = 0; i < (str?.length ?? 0); i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % len;
};

const Center = () => {
  const spotifyApi = useSpotify();
  const playlistId = useRecoilValue(playlistIdState);
  const [playlist, setPlaylist] = useRecoilState(playlistState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playlistId || !spotifyApi.getAccessToken()) return;
    setLoading(true);
    spotifyApi
      .getPlaylist(playlistId)
      .then((data) => setPlaylist(data.body))
      .catch((e) => console.error("Failed to load playlist", e))
      .finally(() => setLoading(false));
  }, [spotifyApi, playlistId, setPlaylist]);

  const gradient = useMemo(
    () => gradients[hashToIndex(playlistId, gradients.length)],
    [playlistId]
  );

  const cover = playlist?.images?.[0]?.url;
  const trackCount = playlist?.tracks?.total ?? 0;

  return (
    <section className="relative flex-1 overflow-hidden rounded-lg bg-panel">
      {/* Sticky top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end p-4">
        <div className="pointer-events-auto">
          <TopBar />
        </div>
      </div>

      <div className="scroll-thin h-full overflow-y-auto">
        {/* Hero */}
        <header
          className={`bg-gradient-to-b ${gradient} to-panel px-4 pb-6 pt-16 sm:px-8`}
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end">
            <div className="relative h-40 w-40 flex-shrink-0 overflow-hidden rounded-md bg-black/40 shadow-2xl sm:h-52 sm:w-52">
              {cover && (
                <Image
                  src={cover}
                  alt={playlist?.name ?? "Playlist cover"}
                  fill
                  sizes="(min-width: 640px) 208px, 160px"
                  className="object-cover"
                  priority
                />
              )}
            </div>
            <div className="min-w-0 text-center sm:pb-2 sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wider">
                Playlist
              </p>
              <h1 className="mt-2 break-words text-3xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                {playlist?.name}
              </h1>
              {playlist?.description && (
                <p className="mt-3 line-clamp-2 text-sm text-gray-300">
                  {decodeHtml(playlist.description)}
                </p>
              )}
              <div className="mt-3 flex items-center justify-center gap-1 text-sm text-gray-300 sm:justify-start">
                {playlist?.owner?.display_name && (
                  <span className="font-semibold text-white">
                    {playlist.owner.display_name}
                  </span>
                )}
                <span>·</span>
                <span>{playlist?.followers?.total ?? 0} likes</span>
                <span>·</span>
                <span>{trackCount} songs</span>
              </div>
            </div>
          </div>
        </header>

        {/* Track list */}
        <div className="px-2 pb-32 sm:px-6">
          {/* Column header */}
          <div className="sticky top-0 z-10 mb-2 grid grid-cols-[16px_1fr_1fr_minmax(0,80px)] items-center gap-4 border-b border-white/10 bg-panel/95 px-4 py-2 text-xs uppercase tracking-wider text-gray-400 backdrop-blur">
            <span className="text-right">#</span>
            <span>Title</span>
            <span className="hidden sm:block">Album</span>
            <span className="flex justify-end">
              <FiClock className="h-4 w-4" />
            </span>
          </div>

          {loading && !playlist ? (
            <SongsSkeleton />
          ) : trackCount === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              This playlist has no tracks.
            </p>
          ) : (
            <Songs />
          )}
        </div>
      </div>
    </section>
  );
};

const SongsSkeleton = () => (
  <div className="space-y-2 px-4 pt-2">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 py-1">
        <div className="h-10 w-10 animate-pulse rounded bg-elevated" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-elevated" />
      </div>
    ))}
  </div>
);

export default Center;
