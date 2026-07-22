import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useRecoilState } from "recoil";
import { playlistIdState } from "@/atoms/playlistAtoms";
import useSpotify from "@/hooks/useSpotify";

const Playlist = () => {
  const spotifyApi = useSpotify();
  const [playlists, setPlaylists] = useState([]);
  const [playlistId, setPlaylistId] = useRecoilState(playlistIdState);
  const { data: session } = useSession();

  useEffect(() => {
    if (!spotifyApi.getAccessToken()) return;
    spotifyApi
      .getUserPlaylists({ limit: 50 })
      .then((data) => setPlaylists(data.body.items))
      .catch((e) => console.error("Failed to load playlists", e));
  }, [session, spotifyApi]);

  return (
    <ul className="space-y-1">
      {playlists.map((playlist) => {
        const isActive = playlistId === playlist.id;
        const cover = playlist.images?.[0]?.url;
        return (
          <li key={playlist.id}>
            <button
              onClick={() => setPlaylistId(playlist.id)}
              className={`flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors duration-200 ${
                isActive ? "bg-hover" : "hover:bg-elevated"
              }`}
            >
              <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded bg-elevated">
                {cover && (
                  <Image
                    src={cover}
                    alt={playlist.name}
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={`truncate text-sm font-medium ${
                    isActive ? "text-spotify" : "text-white"
                  }`}
                >
                  {playlist.name}
                </p>
                <p className="truncate text-xs text-gray-400">
                  Playlist · {playlist.tracks?.total ?? 0} songs
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default Playlist;
