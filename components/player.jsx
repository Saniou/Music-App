import Image from "next/image";
import useSpotify from "../hooks/useSpotify";
import { useRecoilState } from "recoil";
import { currentTrackIdState, isPlayingState } from "../atoms/songAtom";
import { useEffect, useCallback } from "react";
import React, { useState } from "react";
import useSongInfo from "../hooks/useSongInfo";
import { AiOutlinePlayCircle, AiOutlinePauseCircle } from "react-icons/ai";
import { BsArrowLeftRight } from "react-icons/bs";
import {
  TbPlayerTrackPrevFilled,
  TbPlayerTrackNextFilled,
} from "react-icons/tb";
import { GoReply } from "react-icons/go";
import { BsVolumeMute, BsFillVolumeUpFill } from "react-icons/bs";
import { debounce } from "lodash";

const Player = () => {
  const spotifyApi = useSpotify();
  const [volume, setVolume] = useState(50);

  const [currentTrackId, setCurrentTrackId] =
    useRecoilState(currentTrackIdState);

  const [isPlaying, setIsPlaying] = useRecoilState(isPlayingState);

  const songInfo = useSongInfo();

  const fetchCurrentSong = useCallback(() => {
    if (!songInfo) {
      spotifyApi.getMyCurrentPlayingTrack().then((data) => {
        console.log("Now Playing:", data.body?.item);
        setCurrentTrackId(data.body?.item?.id);

        spotifyApi.getMyCurrentPlaybackState().then(() => {
          setIsPlaying(data.body?.is_playing);
        });
      });
    }
  }, [songInfo, spotifyApi, setCurrentTrackId, setIsPlaying]);

  useEffect(() => {
    if (spotifyApi.getAccessToken && !currentTrackId) {
      fetchCurrentSong();
      setVolume(50);
    }
  }, [currentTrackId, fetchCurrentSong, spotifyApi.getAccessToken]);

  useEffect(() => {
    if (volume > 0 && volume < 100) {
      debounceAdjustVolume(volume);
    }
  }, [volume]);

  const debounceAdjustVolume = useCallback(
    debounce((volume) => {
        spotifyApi.setVolume(volume).catch((err) => {})
      }, 500), []);

  const handlePlayPause = () => {
    spotifyApi.getMyCurrentPlaybackState().then((data) => {
      if (data.body.is_playing) {
        spotifyApi.pause();
        setIsPlaying(false);
      } else {
        spotifyApi.play();
        setIsPlaying(true);
      }
    });
  };

  const handleNext = () => {};

  const handlePrew = () => {};

  const handleRandom = () => {};

  return (
    <div className="text-white h-24 bg-gradient-to-b from-[#161618] to-black grid grid-cols-3 text-xs md:text-base px-2 md:px-0">
      <div className="flex items-center space-x-4">
        <Image
          className="hidden md:inline w-10 h-10"
          src={songInfo?.album.images?.[0]?.url}
          width={250}
          height={250}
          alt="info"
        />
        <div className="text-xs mt-3">
          <h3 className="text-xs">{songInfo?.name}</h3>
          <p>{songInfo?.artists?.[0]?.name}</p>
        </div>
      </div>

      <div className="flex items-center justify-evenly">
        <BsArrowLeftRight className="button" />

        <TbPlayerTrackPrevFilled className="button" />

        {isPlaying ? (
          <AiOutlinePauseCircle
            onClick={handlePlayPause}
            className="w-8 h-7 button"
          />
        ) : (
          <AiOutlinePlayCircle
            onClick={handlePlayPause}
            className="w-8 h-7 button"
          />
        )}

        <TbPlayerTrackNextFilled className="button" />

        <GoReply className="button" />
      </div>

      <div className="flex items-center justify-end space-x-3 md:space-x-4 pr-5">
        <BsVolumeMute
          className="button"
          onClick={() => volume > 0 && setVolume(0)}
        />
        <input
          className="w-14 md:w-28 "
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={(event) => {
            setVolume(Number(event.target.value));
          }}
        />
        <BsFillVolumeUpFill
          onClick={() => volume < 100 && setVolume(volume + 5)}
          className="button"
        />
      </div>
    </div>
  );
};

export default Player;
