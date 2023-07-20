import { useEffect, useState } from "react";
import { shuffle } from "lodash";
import { useRecoilState, useRecoilValue } from "recoil";
import { playlistIdState, playlistState } from "@/atoms/playlistAtoms";
import useSpotify from "@/hooks/useSpotify";
import Songs from "./songs";
import ModalWindow from "./modal";

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
      <ModalWindow />
      <section
        className={`mb-[50px] flex items-end space-x-7 bg-gradient-to-b ${color} h-80 text-white p-8 -z-10 w-full rounded-lg`}
      >
        <div className="flex items-center">
          <img
            className="mr-7 lg:w-44 lg:h-44 md:w-[100px] md:h-[100px] sm:w-[50px] sm:h-[50px] h-20 w-20  shadow-2xl"
            src={playlist?.images[0]?.url}
            alt="playlistPhoto"
          />
          <div>
            <p className="text-sm sm:font-sm md:font-md lg:text-3xl">
              PLAYLIST:
            </p>
            <h1 className="text-sm sm:font-sm md:font-md lg:text-3xl font-bold">
              {playlist?.name}
            </h1>
            <p className="opacity-60 mb-2 mt-2 font-[10px] lg:font-xl md:font-md sm:font-sm">
              {playlist?.description}
            </p>
            <p className="">{playlist?.followers.total} likes</p>
          </div>
        </div>
      </section>

      <section>
        <Songs />
      </section>
    </div>
  );
};

export default Center;