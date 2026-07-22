import React from "react";
import { useRecoilValue } from "recoil";
import { playlistState } from "@/atoms/playlistAtoms";
import Song from "./song";

const Songs = () => {
  const playlist = useRecoilValue(playlistState);

  return (
    <ul className="pb-28">
      {playlist?.tracks?.items
        ?.filter((item) => item?.track)
        .map((track, order) => (
          <li key={`${track.track.id}-${order}`}>
            <Song track={track} order={order} />
          </li>
        ))}
    </ul>
  );
};

export default Songs;