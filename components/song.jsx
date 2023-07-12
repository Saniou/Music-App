import React from "react";
import { useRecoilState } from "recoil";
import Image from "next/image";
import { BsFillPlayFill } from "react-icons/bs";
import useSpotify from "@/hooks/useSpotify";
import { formatDuration } from "@/lib/duration";
import { truncateText } from "@/lib/truncate";
import { currentTrackIdState, isPlayingState } from "@/atoms/songAtom";

const Song = ({track, order}) => {
    
    const spotifyApi = useSpotify()
    
    const [currentTrackId, setCurrentTrackId] = useRecoilState(currentTrackIdState)
    
    const [isPlaying, setIsPlaying] = useRecoilState(isPlayingState)
    
    const playSong = () => {
      setCurrentTrackId(track.track.id)
      setIsPlaying(true)
      spotifyApi.play({
        uris: [track.track.uri],
        
      })
    }
    
    return (
      <div key={track.track.id} className="flex rounded-2xl items-center p-5 mr-8 py-2 hover:bg-[#000] hover:transition-[0.5s] hover:-translate-y-1 hover:scale-30">
        <div className="flex items-center text-white w-3/4">
          <p className="pr-4 mt-3">{order + 1}</p>
          <button className="ml-5 cursor-pointer" onClick={playSong}>
            <BsFillPlayFill className="w-8 h-8 mr-5 text-white hover:bg-[#5C67DE] rounded-full hover:scale-110 transition duration-200" />
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
  
        <div className="w-[50%] text-white">
          <p className="text-sm leading-6">{truncateText(track.track.album.name, 7)}</p>
        </div>
  
        <div className="hidden sm:flex sm:flex-col sm:items-end text-white">
          <p className="text-sm leading-6">{formatDuration(track.track.duration_ms)}</p>
        </div>
      </div>
    );
  };
  
  export default Song;