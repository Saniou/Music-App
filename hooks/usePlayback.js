import { useEffect } from "react";
import { getSession } from "next-auth/react";
import { usePlayer } from "@/store/player";
import { coverUrl, currentPosition } from "@/lib/playback";

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const POLL_MS = 8000; // every request counts against the account-wide Dev Mode quota
const LISTEN_TICK_MS = 5000;

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
    const { syncFromApi, rememberProgress, tickListen } = usePlayer.getState();
    syncFromApi();
    const id = setInterval(() => document.visibilityState === "visible" && syncFromApi(), POLL_MS);
    // Listening time for the history; runs even in a background tab, since music plays there too.
    const listenId = setInterval(tickListen, LISTEN_TICK_MS);
    // The last poll can be seconds old; save the exact position (and listening time) on leaving.
    const onHide = () => {
      rememberProgress();
      tickListen();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(id);
      clearInterval(listenId);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  // Sleep timer: pause at the set time, or when the playing track ends.
  const sleep = usePlayer((s) => s.sleep);
  const sleepUri = usePlayer((s) => s.track?.uri);
  const sleepPlaying = usePlayer((s) => s.isPlaying);
  const sleepClock = usePlayer((s) => s.positionAt);
  useEffect(() => {
    if (!sleep) return;
    const s = usePlayer.getState();
    let ms;
    if (sleep.at) ms = sleep.at - Date.now();
    else if (s.isPlaying && s.durationMs) ms = s.durationMs - currentPosition(s) - 400; // just before the next one starts
    else return;
    const id = setTimeout(() => {
      const st = usePlayer.getState();
      if (st.isPlaying) st.togglePlay();
      usePlayer.setState({ sleep: null, notice: "Sleep timer: paused. Good night." });
    }, Math.max(0, ms));
    return () => clearTimeout(id);
  }, [sleep, sleepUri, sleepPlaying, sleepClock]);

  // When our clock says the song is over, ask what plays now instead of waiting for the next poll
  // (up to 8s, or longer if Spotify made us back off), so the next song shows right away.
  useEffect(() => {
    const s = usePlayer.getState();
    if (!s.isPlaying || !s.durationMs || !sleepUri) return;
    const ms = s.durationMs - currentPosition(s) + 1200; // a beat after the end, once Spotify has moved on
    const id = setTimeout(() => usePlayer.getState().syncFromApi({ force: true }), Math.max(0, ms));
    return () => clearTimeout(id);
  }, [sleepUri, sleepPlaying, sleepClock]);

  // A notification per new song while the tab is hidden (opt-in, see toggleSongNotifications).
  // One tag, so each replaces the last instead of piling up; silent, the music is the sound.
  const notifyOn = usePlayer((s) => s.songNotifications);
  useEffect(() => {
    if (!notifyOn || !sleepUri || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return;
    const t = usePlayer.getState().track;
    if (!t) return;
    try {
      const n = new Notification(t.name, {
        body: [t.artists.map((a) => a.name).join(", "), t.album?.name].filter(Boolean).join(" · "),
        icon: coverUrl(t.album?.images, 300) ?? undefined,
        tag: "musify-now-playing",
        silent: true,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {} // some browsers only allow notifications from a service worker
  }, [sleepUri, notifyOn]);

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
