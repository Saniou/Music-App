import React from "react";
import { useRecoilValue } from "recoil";
import { playlistState } from "@/atoms/playlistAtoms";
import Song from "./song";

const Songs = () => {
  const playlist = useRecoilValue(playlistState);

  return (
    <ul>
      {playlist?.tracks.items.map((track, order) => (
        <li key={track.track.id}>
          <Song track={track} order={order} />
        </li>
      ))}
    </ul>
  );
};

export default Songs;