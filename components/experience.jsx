import { useCallback, useEffect, useMemo, useState } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { playlistIdState, playlistState } from "@/atoms/playlistAtoms";
import { currentTrackIdState, isPlayingState } from "@/atoms/songAtom";
import useSpotify from "@/hooks/useSpotify";
import NowPlaying from "./nowPlaying";
import Timeline from "./timeline";
import TopBar from "./topBar";
import PlaylistMenu from "./playlistMenu";

const Experience = () => {
  const spotifyApi = useSpotify();
  const playlistId = useRecoilValue(playlistIdState);
  const [playlist, setPlaylist] = useRecoilState(playlistState);
  const [, setCurrentTrackId] = useRecoilState(currentTrackIdState);
  const [isPlaying, setIsPlaying] = useRecoilState(isPlayingState);
  const [activeIndex, setActiveIndex] = useState(0);

  // Load the selected playlist.
  useEffect(() => {
    if (!playlistId || !spotifyApi.getAccessToken()) return;
    spotifyApi
      .getPlaylist(playlistId)
      .then((data) => {
        setPlaylist(data.body);
        setActiveIndex(0);
      })
      .catch((e) => console.error("Failed to load playlist", e));
  }, [spotifyApi, playlistId, setPlaylist]);

  const tracks = useMemo(
    () =>
      playlist?.tracks?.items
        ?.filter((item) => item?.track?.album?.images?.length)
        .map((item) => item.track) ?? [],
    [playlist]
  );

  const activeTrack = tracks[activeIndex] ?? null;

  const playTrack = useCallback(
    (track) => {
      if (!track) return;
      setCurrentTrackId(track.id);
      setIsPlaying(true);
      spotifyApi.play({ uris: [track.uri] }).catch((e) => {
        // No active device or playback error — keep UI state, surface in console.
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
      } else {
        if (body?.item) {
          await spotifyApi.play();
        } else {
          playTrack(activeTrack);
        }
        setIsPlaying(true);
      }
    } catch (error) {
      playTrack(activeTrack);
    }
  }, [spotifyApi, setIsPlaying, playTrack, activeTrack]);

  // Keyboard navigation.
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
      {/* Ambient backdrop from active cover */}
      <BackdropGlow url={activeTrack?.album?.images?.[0]?.url} />

      {/* Top bar */}
      <header className="relative z-20 flex items-center justify-between px-6 py-5">
        <PlaylistMenu />
        <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-script text-4xl font-bold">
          {playlist?.name ?? "Musify"}
        </h1>
        <TopBar />
      </header>

      {/* Now playing */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4">
        <NowPlaying
          track={activeTrack}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrev={handlePrev}
          hasNext={activeIndex < tracks.length - 1}
          hasPrev={activeIndex > 0}
        />
      </main>

      {/* Timeline */}
      <footer className="relative z-10 pb-8 pt-2">
        <Timeline tracks={tracks} activeIndex={activeIndex} onSelect={selectIndex} />
      </footer>
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
