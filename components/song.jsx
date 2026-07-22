import React from "react";
import { useRecoilState } from "recoil";
import Image from "next/image";
import { BsFillPlayFill } from "react-icons/bs";
import useSpotify from "@/hooks/useSpotify";
import { formatDuration } from "@/lib/duration";
import { truncateText } from "@/lib/truncate";
import { currentTrackIdState, isPlayingState } from "@/atoms/songAtom";

const Song = ({ track, order }) => {
  const spotifyApi = useSpotify();
  const [currentTrackId, setCurrentTrackId] = useRecoilState(currentTrackIdState);
  const setIsPlaying = useRecoilState(isPlayingState)[1];

  const song = track?.track;
  const isActive = currentTrackId === song?.id;

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
      className={`group flex cursor-pointer items-center rounded-2xl p-5 py-2 mr-8 transition duration-300 hover:bg-black/60 hover:-translate-y-0.5 ${
        isActive ? "bg-black/40" : ""
      }`}
    >
      <div className="flex w-3/4 items-center text-white">
        <p className={`pr-4 ${isActive ? "text-green-500" : ""}`}>{order + 1}</p>
        <button className="ml-5" onClick={(e) => { e.stopPropagation(); playSong(); }} aria-label={`Play ${song.name}`}>
          <BsFillPlayFill className="mr-5 h-8 w-8 rounded-full text-white transition duration-200 hover:scale-110 hover:bg-[#5C67DE]" />
        </button>
        {song.album?.images?.[0]?.url && (
          <Image
            className="mr-4 h-10 w-10 object-cover"
            src={song.album.images[0].url}
            alt={song.album?.name ?? "Album art"}
            width={40}
            height={40}
          />
        )}
        <div className="flex flex-col text-white">
          <p className={`text-sm font-semibold leading-6 ${isActive ? "text-green-500" : ""}`}>
            {truncateText(song.name, 3)}
          </p>
          <p className="text-xs leading-5 text-gray-500">{song.artists?.[0]?.name}</p>
        </div>
      </div>

      <div className="w-1/2 text-white">
        <p className="hidden text-sm leading-6 sm:inline">
          {truncateText(song.album?.name ?? "", 7)}
        </p>
      </div>

      <div className="hidden text-white sm:flex sm:flex-col sm:items-end">
        <p className="text-sm leading-6">{formatDuration(song.duration_ms)}</p>
      </div>
    </div>
  );
};

export default Song;
