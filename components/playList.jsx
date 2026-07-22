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
      {playlist.map((item) => (
        <div
          key={item.id}
          className={`flex cursor-pointer items-center p-2 transition hover:opacity-60 ${
            playlistId === item.id ? "opacity-100" : "opacity-80"
          }`}
          onClick={() => handlePlaylistClick(item.id)}
        >
          <div className="flex items-center">
            <div className="relative h-10 w-10">
              {item.images?.[0]?.url && (
                <Image
                  className="h-10 w-10 object-cover sm:pr-2"
                  src={item.images[0].url}
                  width={40}
                  height={40}
                  alt={item.name ?? "Playlist"}
                />
              )}
            </div>
            <p className="hidden pl-3 text-[8px] md:inline lg:text-[10px] md:text-[8px]">
              {item.name}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Playlist;