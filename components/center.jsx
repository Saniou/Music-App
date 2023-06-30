import { useSession } from "next-auth/react";
import { MdOutlineKeyboardArrowDown } from 'react-icons/md'
import Image from "next/image";
import { useEffect, useState } from "react";
import { shuffle } from "lodash";
import { useRecoilState, useRecoilValue } from "recoil";
import { playlistIdState, playlistState } from "@/atoms/playlistAtoms";
import useSpotify from "@/hooks/useSpotify";
import Songs from "./songs";

const colors = [
  "from-indigo-500",
  "from-blue-500",
  "from-red-500",
  "from-cyan-500",
  "from-rose-500",
  "from-orange-800",
  "from-lime-500",
  "from-emerald-600",
  "from-violet-500",
  "from-pink-500",
];

const Center = () => {
  const { data: session } = useSession();
  const spotifyApi = useSpotify();
  const [color, setColors] = useState(null);
  const playlistId = useRecoilValue(playlistIdState);
  const [playlist, setPlaylist] = useRecoilState(playlistState);

  useEffect(() => {
    setColors(shuffle(colors).pop());
  }, [playlistId]);

  useEffect(() => {
    spotifyApi
      .getPlaylist(playlistId)
      .then((data) => {
        setPlaylist(data.body);
      })
      .catch((e) => console.error(e));
  }, [spotifyApi, playlistId, setPlaylist]);

  console.log(playlist);

  return (
    <div className="flex-grow h-screen overflow-y-scroll scrollbar-hide">
      <header className="absolute top-5 right-8 cursor-pointer">
        <div className="flex items-center space-x-3 bg-[#000] rounded-full p-1 pr-2 hover:opacity-70">
          <Image
            className="rounded-full w-[25%]"
            width={25}
            height={20}
            src={session?.user.image}
            alt="img"
            style={{ objectFit: 'cover', objectPosition: 'center', width: '25px', height: '25px' }}
          />
          <h2>{session?.user.name}</h2>
          <button>
            <MdOutlineKeyboardArrowDown size={25} />
          </button>
        </div>
      </header>

      <section className={`mb-[50px] flex items-end space-x-7 bg-gradient-to-b ${color} h-80 text-white p-8 -z-10 w-full rounded-lg`}>
        <div className="flex items-center">
          <img className="mr-7 h-44 w-44 shadow-2xl" src={playlist?.images[0]?.url} alt="playlistPhoto" />
          <div>
            <p className="text-2xl">PLAYLIST:</p>
            <h1 className="text-2xl md:text-3xl lg:text-5xl font-bold">{playlist?.name}</h1>
            <p className="opacity-60 mb-2 mt-2">{playlist?.description}</p>
            <p className="">{playlist?.followers.total} likes</p>
          </div>
        </div>
      </section>

      <section className="">
        <Songs />
      </section>
    </div>
  );
};

export default Center;