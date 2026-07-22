import { useCallback, useEffect, useState } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { FiAlertCircle, FiLoader } from "react-icons/fi";
import { playlistIdState, playlistState } from "@/atoms/playlistAtoms";
import { currentTrackIdState, isPlayingState } from "@/atoms/songAtom";
import useSpotify from "@/hooks/useSpotify";
import NowPlaying from "./nowPlaying";
import Timeline from "./timeline";
import TopBar from "./topBar";
import PlaylistMenu from "./playlistMenu";

const TRACK_LIMIT = 150; // how many tracks to page in

const Experience = () => {
  const spotifyApi = useSpotify();
  const [playlistId, setPlaylistId] = useRecoilState(playlistIdState);
  const [playlist, setPlaylist] = useRecoilState(playlistState);
  const [, setCurrentTrackId] = useRecoilState(currentTrackIdState);
  const [isPlaying, setIsPlaying] = useRecoilState(isPlayingState);

  const [tracks, setTracks] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | empty | error

  // Auto-select the user's first playlist when nothing is chosen yet.
  useEffect(() => {
    if (playlistId || !spotifyApi.getAccessToken()) return;
    spotifyApi
      .getUserPlaylists({ limit: 50 })
      .then((data) => {
        const items = data.body.items ?? [];
        // Editorial/algorithmic playlists (owner = "spotify") now serve their
        // tracks with restrictions, so prefer a playlist the user owns.
        const preferred =
          items.find((p) => p.owner?.id && p.owner.id !== "spotify") ?? items[0];
        if (preferred) setPlaylistId(preferred.id);
        else setStatus("empty");
      })
      .catch((e) => console.error("Failed to load user playlists", e));
  }, [playlistId, spotifyApi, setPlaylistId]);

  // Load metadata + tracks for the selected playlist.
  useEffect(() => {
    if (!playlistId || !spotifyApi.getAccessToken()) return;
    let cancelled = false;
    setStatus("loading");
    setTracks([]);

    (async () => {
      try {
        const meta = await spotifyApi.getPlaylist(playlistId);
        if (cancelled) return;
        setPlaylist(meta.body);

        // The dedicated /tracks endpoint (with market) is far more reliable
        // than the tracks nested in getPlaylist, and lets us paginate.
        const collected = [];
        let offset = 0;
        const limit = 50;
        while (offset < TRACK_LIMIT) {
          const res = await spotifyApi.getPlaylistTracks(playlistId, {
            limit,
            offset,
            market: "from_token",
          });
          const items = res.body.items ?? [];
          collected.push(...items);
          if (items.length < limit || collected.length >= (res.body.total ?? 0)) break;
          offset += limit;
        }
        if (cancelled) return;

        const mapped = collected.map((i) => i.track).filter((t) => t?.id);
        setTracks(mapped);
        setActiveIndex(0);
        setStatus(mapped.length ? "ready" : "empty");
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to load playlist tracks", e);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playlistId, spotifyApi, setPlaylist]);

  const activeTrack = tracks[activeIndex] ?? null;

  const playTrack = useCallback(
    (track) => {
      if (!track) return;
      setCurrentTrackId(track.id);
      setIsPlaying(true);
      spotifyApi.play({ uris: [track.uri] }).catch((e) => {
        console.error("Playback failed (open Spotify on a device first)", e);
      });
    },
    [spotifyApi, setCurrentTrackId, setIsPlaying]
  );

  const selectIndex = useCallback(
    (index) => {
      if (index < 0 || index >= tracks.length) return;
      setActiveIndex(index);
      playTrack(tracks[index]);
    },
    [tracks, playTrack]
  );

  const handleNext = useCallback(() => selectIndex(activeIndex + 1), [selectIndex, activeIndex]);
  const handlePrev = useCallback(() => selectIndex(activeIndex - 1), [selectIndex, activeIndex]);

  const handlePlayPause = useCallback(async () => {
    try {
      const { body } = await spotifyApi.getMyCurrentPlaybackState();
      if (body?.is_playing) {
        await spotifyApi.pause();
        setIsPlaying(false);
      } else if (body?.item) {
        await spotifyApi.play();
        setIsPlaying(true);
      } else {
        playTrack(activeTrack);
      }
    } catch (error) {
      playTrack(activeTrack);
    }
  }, [spotifyApi, setIsPlaying, playTrack, activeTrack]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") handleNext();
      else if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === " ") {
        e.preventDefault();
        handlePlayPause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext, handlePrev, handlePlayPause]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-base text-white">
      <BackdropGlow url={activeTrack?.album?.images?.[0]?.url} />

      <header className="relative z-20 flex items-center justify-between px-6 py-5">
        <PlaylistMenu />
        <h1 className="pointer-events-none absolute left-1/2 max-w-[50vw] -translate-x-1/2 truncate text-center font-script text-3xl font-bold sm:text-4xl">
          {playlist?.name ?? "Musify"}
        </h1>
        <TopBar />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4">
        {status === "ready" ? (
          <NowPlaying
            track={activeTrack}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onNext={handleNext}
            onPrev={handlePrev}
            hasNext={activeIndex < tracks.length - 1}
            hasPrev={activeIndex > 0}
          />
        ) : (
          <StatusMessage status={status} />
        )}
      </main>

      <footer className="relative z-10 pb-8 pt-2">
        {status === "ready" && (
          <Timeline tracks={tracks} activeIndex={activeIndex} onSelect={selectIndex} />
        )}
      </footer>
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
    empty: "This playlist has no playable tracks. Pick another from “Playlists”.",
    error:
      "Spotify won’t serve this playlist’s tracks (it may be an editorial or restricted playlist). Choose one of your own from “Playlists”.",
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
