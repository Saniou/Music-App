import Image from "next/image";
import { useRecoilState } from "recoil";
import { BsFillPlayFill, BsPauseFill } from "react-icons/bs";
import useSpotify from "@/hooks/useSpotify";
import { formatDuration } from "@/lib/duration";
import { currentTrackIdState, isPlayingState } from "@/atoms/songAtom";

const Song = ({ track, order }) => {
  const spotifyApi = useSpotify();
  const [currentTrackId, setCurrentTrackId] = useRecoilState(currentTrackIdState);
  const [isPlaying, setIsPlaying] = useRecoilState(isPlayingState);

  const song = track?.track;
  const isActive = currentTrackId === song?.id;
  const cover = song?.album?.images?.[0]?.url;

  const playSong = () => {
    if (!song) return;
    setCurrentTrackId(song.id);
    setIsPlaying(true);
    spotifyApi.play({ uris: [song.uri] }).catch((e) => console.error("Play failed", e));
  };

  if (!song) return null;

  return (
    <div
      onClick={playSong}
      className="group grid cursor-pointer grid-cols-[16px_1fr_1fr_minmax(0,80px)] items-center gap-4 rounded-md px-4 py-2 transition-colors duration-200 hover:bg-hover"
    >
      {/* Index / play indicator */}
      <div className="flex items-center justify-end text-sm text-gray-400">
        <span className={`group-hover:hidden ${isActive ? "text-spotify" : ""}`}>
          {isActive && isPlaying ? (
            <BsPauseFill className="h-4 w-4 text-spotify" />
          ) : (
            order + 1
          )}
        </span>
        <BsFillPlayFill className="hidden h-5 w-5 text-white group-hover:block" />
      </div>

      {/* Title */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-elevated">
          {cover && (
            <Image src={cover} alt={song.album?.name ?? "Album art"} fill sizes="40px" className="object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <p className={`truncate text-sm font-medium ${isActive ? "text-spotify" : "text-white"}`}>
            {song.name}
          </p>
          <p className="truncate text-xs text-gray-400">
            {song.artists?.map((a) => a.name).join(", ")}
          </p>
        </div>
      </div>

      {/* Album */}
      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm text-gray-400">{song.album?.name}</p>
      </div>

      {/* Duration */}
      <div className="flex justify-end text-sm text-gray-400">
        {formatDuration(song.duration_ms)}
      </div>
    </div>
  );
};

export default Song;
