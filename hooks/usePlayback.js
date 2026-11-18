import { useEffect } from "react";
import { getSession } from "next-auth/react";
import { usePlayer } from "@/store/player";
import { currentPosition } from "@/lib/playback";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const POLL_MS = 5000;

// Wires the player store to the outside world: the Web Playback SDK (this tab as a Spotify
// device), Web API polling (any other device) and the Media Session (OS media keys and card).
export default function usePlayback() {
  useEffect(() => {
    let player;
    const init = () => {
      player = new window.Spotify.Player({
        name: "Musify Web Player",
        // getSession() runs NextAuth's jwt callback, so an expired token gets refreshed first.
        getOAuthToken: (cb) => getSession().then((s) => s?.user?.accessToken && cb(s.user.accessToken)),
        volume: usePlayer.getState().volume,
      });
      const notify = (notice) => () => usePlayer.setState({ notice });
      player.addListener("ready", ({ device_id }) => usePlayer.setState({ sdkPlayer: player, sdkDeviceId: device_id }));
      player.addListener("not_ready", () => usePlayer.setState({ sdkDeviceId: null }));
      // null means this tab stopped being the active device; polling takes over.
      player.addListener("player_state_changed", (s) => s && usePlayer.getState().applySdkState(s));
      player.addListener("account_error", notify("Listening in the browser needs Spotify Premium. You can still control Spotify on another device."));
      player.addListener("authentication_error", notify("Spotify rejected the session. Sign out and sign in again."));
      player.addListener("initialization_error", notify("This browser can’t run the Spotify web player. Open Spotify on another device."));
      player.addListener("playback_error", notify("Spotify couldn’t play this track."));
      player.connect();
    };

    if (window.Spotify) init();
    else {
      window.onSpotifyWebPlaybackSDKReady = init;
      if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = SDK_SRC;
        script.async = true;
        document.body.appendChild(script);
      }
    }
    return () => {
      player?.disconnect();
      usePlayer.setState({ sdkPlayer: null, sdkDeviceId: null });
    };
  }, []);

  useEffect(() => {
    const { syncFromApi, rememberProgress } = usePlayer.getState();
    syncFromApi();
    const id = setInterval(() => document.visibilityState === "visible" && syncFromApi(), POLL_MS);
    // The last poll can be seconds old; save the exact position when the tab goes away.
    window.addEventListener("pagehide", rememberProgress);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", rememberProgress);
    };
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const p = () => usePlayer.getState();
    const handlers = {
      play: () => !p().isPlaying && p().togglePlay(),
      pause: () => p().isPlaying && p().togglePlay(),
      nexttrack: () => p().next(),
      previoustrack: () => p().prev(),
      seekto: (d) => p().seek(d.seekTime * 1000),
    };
    const setAll = (fn) => {
      for (const action of Object.keys(handlers)) {
        try {
          navigator.mediaSession.setActionHandler(action, fn(action));
        } catch {} // unsupported action in this browser
      }
    };
    setAll((a) => handlers[a]);
    return () => setAll(() => null);
  }, []);

  const uri = usePlayer((s) => s.track?.uri);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const positionAt = usePlayer((s) => s.positionAt);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const t = usePlayer.getState().track;
    navigator.mediaSession.metadata = t
      ? new MediaMetadata({
          title: t.name,
          artist: t.artists.map((a) => a.name).join(", "),
          album: t.album.name ?? "",
          artwork: (t.album.images ?? []).map((i) => ({ src: i.url, ...(i.width && { sizes: `${i.width}x${i.height}` }) })),
        })
      : null;
  }, [uri]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const s = usePlayer.getState();
    navigator.mediaSession.playbackState = uri ? (isPlaying ? "playing" : "paused") : "none";
    if (!uri || !s.durationMs) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: s.durationMs / 1000,
        position: currentPosition(s) / 1000,
        playbackRate: 1,
      });
    } catch {} // position briefly past duration between tracks
  }, [uri, isPlaying, positionAt]);
}
