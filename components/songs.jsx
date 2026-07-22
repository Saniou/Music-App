import { useRecoilValue } from "recoil";
import { playlistState } from "@/atoms/playlistAtoms";
import Song from "./song";

const Songs = () => {
  const playlist = useRecoilValue(playlistState);
  const items = playlist?.tracks?.items?.filter((item) => item?.track) ?? [];

  return (
    <div>
      {items.map((item, order) => (
        <Song key={`${item.track.id}-${order}`} track={item} order={order} />
      ))}
    </div>
  );
};

export default Songs;
