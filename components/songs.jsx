import React from "react";
import { useRecoilValue } from "recoil";
import { playlistState } from "@/atoms/playlistAtoms";
import Image from "next/image";
import { BsFillPlayFill } from "react-icons/bs";

const Songs = () => {
  const playlist = useRecoilValue(playlistState);

  const formatDuration = (duration) => {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const truncateText = (text, limit) => {
    if (text.length <= limit) {
      return text;
    }
    return text.split(" ").slice(0, limit).join(" ") + "...";
  };

  return (
    <ul>
      {playlist?.tracks.items.map((track, i) => (
        <li key={i} className="flex rounded-2xl items-center p-5 mr-8 py-2 hover:bg-[#000] hover:transition-[0.5s] hover:-translate-y-1 hover:scale-30">
          <div className="flex items-center text-white w-3/4">
            <p className="pr-4 mt-3">{i + 1}</p>
            <button className="ml-5 cursor-pointer">
                 <BsFillPlayFill className="w-8 h-8 mr-5 text-white hover:bg-[#5C67DE] rounded-full  hover:scale-110 transition duration-200" />
              </button>
            <Image
              className="object-cover w-10 h-10 mr-4"
              src={track.track.album.images[0].url}
              alt="Track Image"
              width={250}
              height={250}
            />
            <div className="flex text-white flex-col">
              <p className="text-sm font-semibold leading-6">{truncateText(track.track.name, 3)}</p>
              <p className="text-xs leading-5 text-gray-500">{track.track.artists[0].name}</p>
            </div>
          </div>
          
          <div className="w-[95%] text-white">
            <p className="text-sm  leading-6">{track.track.album.name}</p>
          </div>
          
          <div className="hidden sm:flex sm:flex-col sm:items-end text-white">
            <p className="text-sm leading-6">{formatDuration(track.track.duration_ms)}</p>
          </div>
          
        </li>
      ))}
    </ul>
  );
};

export default Songs;