import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import useSpotify from "@/hooks/useSpotify";
import Image from "next/image";
import { playlistIdState } from "@/atoms/playlistAtoms";
import { useRecoilState } from "recoil";

const Playlist = () => {
  const spotifyApi = useSpotify();
  const [playlist, setPlaylist] = useState([]);
  const [playlistId, setPlaylistId] = useRecoilState(playlistIdState);

  const { data: session } = useSession();

  useEffect(() => {
    if (spotifyApi.getAccessToken()) {
      spotifyApi.getUserPlaylists().then((data) => {
        setPlaylist(data.body.items);
      });
    }
  }, [session, spotifyApi]);

  const handlePlaylistClick = (playlistId) => {
    setPlaylistId(playlistId);
  };

  return (
    <div className="items-center mb-[90px]">
      {playlist.map((playlist, index) => (
        <div key={index}>
          <div
            className="flex p-2 items-center cursor-pointer hover:opacity-60"
            onClick={() => handlePlaylistClick(playlist.id)}
          >
            <div className="flex items-center">
              <div className="relative w-10 h-10">
                <Image
                  className="object-cover w-10 h-10 sm:pr-2"
                  src={playlist.images[0]?.url}
                  width={100}
                  height={100}
                  alt="Playlist Image"
                />
              </div>
              <p className="text-[8px] lg:text-[10px] md:text-[8px] sm:text-[6px] pl-3 hidden md:inline sm:hidden">
                {playlist.name}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Playlist;