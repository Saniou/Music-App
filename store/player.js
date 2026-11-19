import { create } from "zustand";
import { spotifyAuth } from "@/hooks/useSpotify";
import { apiGet, apiSend, isQuotaExceeded, isRateLimited, player, qs } from "@/lib/api";
import {
  REPEAT_MODES,
  coverUrl,
  currentPosition,
  explainError,
  indexOfTrack,
  nextRepeat,
  normalizeTrack,
  reconcilePosition,
} from "@/lib/playback";
import { HISTORY_CAP, MIN_LISTEN_MS } from "@/lib/history";

const TRACK_LIMIT = 150; // how many tracks to page in
const POLL_GRACE_MS = 1500; // ignore polls right after a command so stale state doesn't undo the optimistic UI
const IDLE_POLL_MS = 15_000; // poll interval while nothing plays (5s otherwise, see usePlayback)
const VOLUME_HOLD_MS = 2500; // after a local volume change, ignore reported volume this long

// Collections other than playlists, keyed like playlist ids ("album:<id>" too), so selecting,
// resuming, search and the timeline work the same for all of them.
export const COLLECTIONS = {
  liked: { name: "Liked Songs" },
  recent: { name: "Recently played" },
  "top:short_term": { name: "Top tracks · 4 weeks" },
  "top:medium_term": { name: "Top tracks · 6 months" },
  "top:long_term": { name: "Top tracks · all time" },
};
const isCollectionKey = (id) => id in COLLECTIONS || id.startsWith("album:");

const pageThrough = async (path, pick) => {
  const out = [];
  const limit = 50;
  for (let offset = 0; offset < TRACK_LIMIT; offset += limit) {
    const page = await apiGet(`${path}${path.includes("?") ? "&" : "?"}${qs({ limit, offset })}`);
    const items = page.items ?? [];
    out.push(...items.map(pick));
    if (items.length < limit || !page.next) break;
  }
  return out;
};

// -> { meta: { name, images?, uri? }, raw: Spotify track objects }
async function loadCollection(key) {
  if (key === "liked") return { meta: COLLECTIONS.liked, raw: await pageThrough("/me/tracks", (i) => i.track) };
  if (key === "recent") {
    const { items = [] } = await apiGet("/me/player/recently-played?limit=50"); // no offset paging here
    return { meta: COLLECTIONS.recent, raw: items.map((i) => i.track) };
  }
  if (key.startsWith("top:"))
    return { meta: COLLECTIONS[key], raw: await pageThrough(`/me/top/tracks?${qs({ time_range: key.slice(4) })}`, (t) => t) };
  const id = key.slice("album:".length);
  const album = await apiGet(`/albums/${id}`);
  const albumRef = { id: album.id, name: album.name, images: album.images, uri: album.uri };
  // Album tracks come without `album`; attach it so covers and the album link work.
  const raw = await pageThrough(`/albums/${id}/tracks`, (t) => ({ ...t, album: albumRef }));
  return { meta: { name: album.name, images: album.images, uri: album.uri }, raw };
}

// Spotify's Feb 2026 Dev Mode changes replaced GET /playlists/{id}/tracks with /items (and each
// entry's `track` with `item`).
// Only playlists the user owns or collaborates on return items.
const getPlaylistItems = (id, offset, limit) => apiGet(`/playlists/${id}/items?limit=${limit}&offset=${offset}`);
// The queue is still open in Dev Mode: while a playlist plays it lists the next ~20 tracks.
const getQueue = () => apiGet("/me/player/queue");
const entryTrack = (entry) => entry?.item ?? entry?.track; // new name, then the pre-2026 one
export const playlistTotal = (p) => p?.items?.total ?? p?.tracks?.total ?? 0;
export const canReadItems = (p, userId) => !!p && (p.collaborative || p.owner?.id === userId);

// Where the user left off, per Spotify account, in localStorage:
// { playlistId, playlists: { [id]: { uri, positionMs, discovered? } } }.
// Browser storage can be missing or throw (private mode, blocked site data): then we just don't resume.
const DISCOVERED_CAP = 300; // play-only playlists: how many collected tracks to keep
// v2: v1 could hold tracks from another playlist's stale queue; dropping it is cheaper than cleaning it.
const resumeKey = (userId) => `musify:resume:v2:${userId}`;
const readResume = (userId) => {
  try {
    return (userId && JSON.parse(localStorage.getItem(resumeKey(userId)))) || {};
  } catch {
    return {};
  }
};
const writeResume = (userId, update) => {
  if (!userId) return;
  try {
    localStorage.setItem(resumeKey(userId), JSON.stringify(update(readResume(userId))));
  } catch {} // full or blocked storage: resuming is a convenience, not worth an error
};
// Only what the UI and matching need; full album objects would eat the storage quota.
const slimTrack = (t) => ({
  id: t.id,
  uri: t.uri,
  linkedUri: t.linkedUri,
  name: t.name,
  artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
  album: { id: t.album?.id, name: t.album?.name, images: t.album?.images ?? [] },
  durationMs: t.durationMs,
  url: t.url,
});

// Lyrics display settings, remembered in this browser.
const LYRICS_SETTINGS_KEY = "musify:lyrics-settings:v1";
// script: how Japanese lyrics show: "original" (default), "romaji", or "both" (romaji under each line).
export const LYRICS_DEFAULTS = { size: "m", align: "center", wordByWord: true, coverColor: false, script: "original" };
const readLyricsSettings = () => {
  try {
    return { ...LYRICS_DEFAULTS, ...JSON.parse(localStorage.getItem(LYRICS_SETTINGS_KEY)) };
  } catch {
    return LYRICS_DEFAULTS; // no storage (server render, private mode): defaults
  }
};

// Small UI state remembered in this browser (e.g. lyrics open).
const UI_KEY = "musify:ui:v1";
const readUiState = () => {
  try {
    return JSON.parse(localStorage.getItem(UI_KEY)) ?? {};
  } catch {
    return {}; // server render or blocked storage
  }
};
const writeUiState = (patch) => {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify({ ...readUiState(), ...patch }));
  } catch {}
};

// Our own listening log (Spotify only returns the last 50 plays), per account, in this browser.
const historyKey = (userId) => `musify:history:v1:${userId}`;
export const readHistory = (userId) => {
  try {
    return (userId && JSON.parse(localStorage.getItem(historyKey(userId)))) || [];
  } catch {
    return [];
  }
};
const appendHistory = (userId, entry) => {
  if (!userId) return;
  try {
    localStorage.setItem(historyKey(userId), JSON.stringify([...readHistory(userId), entry].slice(-HISTORY_CAP)));
  } catch {} // full or blocked storage: the log is a nicety
};
// The play being timed: { uri, entry, at, ms, lastTick }. Not UI state, so not in the store.
let listen = null;

let volumeTimer = 0;
let seekTimer = 0;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The one place player state lives. Spotify is the source of truth: commands update the UI
// optimistically, then Web Playback SDK events and Web API polls confirm or correct it.
export const usePlayer = create((set, get) => {
  const command = async (optimistic, call) => {
    const before = get();
    set({ ...optimistic, lastCommandAt: Date.now() });
    try {
      await call();
      setTimeout(() => get().syncFromApi({ force: true }), 1000);
    } catch (e) {
      console.error("Spotify command failed", e?.body ?? e);
      const rollback = Object.fromEntries(Object.keys(optimistic).map((k) => [k, before[k]]));
      set({ ...rollback, notice: explainError(e) });
    }
  };

  const remember = (playlistId, patch) =>
    writeResume(get().userId, (r) => ({
      ...r,
      playlists: { ...r.playlists, [playlistId]: { ...r.playlists?.[playlistId], ...patch } },
    }));

  // Save the playing track and position, but only while it plays from the selected playlist.
  const rememberProgress = () => {
    const s = get();
    if (!s.playlistId || !s.track) return;
    const fromHere =
      s.status === "context" ? s.contextUri === s.playlist?.uri : s.status === "ready" && indexOfTrack(s.tracks, s.track) >= 0;
    if (fromHere) remember(s.playlistId, { uri: s.track.uri, positionMs: Math.round(currentPosition(s)) });
  };

  const playingHereFrom = (s) => s.status === "context" && !!s.track && s.contextUri === s.playlist?.uri;

  // Play-only playlist: add the upcoming tracks from the queue, so the timeline fills ~20 at a time.
  // ponytail: with autoplay on, the queue near the playlist's end can hold Spotify's suggestions,
  // which we can't tell apart from playlist tracks; they get added too.
  const discoverFromQueue = async () => {
    const id = get().playlistId;
    if (!playingHereFrom(get())) return;
    try {
      const { queue = [], currently_playing } = await getQueue();
      const s = get();
      if (s.playlistId !== id || !playingHereFrom(s)) return;
      // Right after a switch Spotify can still return the previous context's queue. Trust it only
      // when it agrees on what's playing now; the next track change asks again.
      if (!currently_playing?.uri || indexOfTrack([s.track], normalizeTrack(currently_playing)) < 0) return;
      const seen = new Set(s.tracks.map((t) => t.uri));
      const fresh = queue
        .map(normalizeTrack)
        .filter((t) => t?.id && !seen.has(t.uri) && indexOfTrack(s.tracks, t) < 0 && seen.add(t.uri));
      if (!fresh.length) return;
      const tracks = [...s.tracks, ...fresh];
      set({ tracks });
      remember(id, { discovered: tracks.slice(-DISCOVERED_CAP).map(slimTrack) });
    } catch (e) {
      console.warn("Queue lookup failed", e?.body ?? e);
    }
  };

  // Time what plays; a track heard for MIN_LISTEN_MS or more goes into the history when it ends.
  // Called every few seconds (usePlayback) and right around track changes for precision.
  const tickListen = () => {
    const s = get();
    const now = Date.now();
    if (listen && listen.uri === s.track?.uri && s.isPlaying) listen.ms += now - listen.lastTick;
    if (listen) listen.lastTick = now;
    if (listen && listen.uri !== s.track?.uri) {
      if (listen.ms >= MIN_LISTEN_MS) appendHistory(s.userId, { ...listen.entry, ms: Math.round(listen.ms), at: listen.at });
      listen = null;
    }
    if (!listen && s.track && s.isPlaying) {
      const t = s.track;
      listen = {
        uri: t.uri,
        at: now,
        ms: 0,
        lastTick: now,
        entry: {
          uri: t.uri,
          name: t.name,
          artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
          cover: coverUrl(t.album?.images, 80),
        },
      };
    }
  };

  // positionAt: when positionMs was true (defaults to now).
  const applyPlayback = ({ contextUri, positionAt = Date.now(), ...p }) => {
    let { tracks } = get();
    const prev = get();
    const { status, playlist, playlistId } = prev;
    const prevUri = prev.track?.uri;
    if (p.track?.uri !== prevUri) tickListen(); // credit the old track up to now
    const sameTrack = !!prevUri && prevUri === p.track?.uri;
    let clock;
    if (p.positionMs === undefined && sameTrack) {
      // A report without a position (SDK polls, see syncFromApi): keep the running clock, only
      // following a play/pause change (frozen where it is now), and not during a seek.
      const isPlaying = prev.seekAt ? prev.isPlaying : p.isPlaying;
      clock =
        isPlaying === prev.isPlaying
          ? { positionMs: prev.positionMs, positionAt: prev.positionAt, isPlaying }
          : { positionMs: currentPosition(prev), positionAt: Date.now(), isPlaying };
    } else {
      clock = reconcilePosition({ ...prev, trackUri: prevUri }, { ...p, positionAt, trackUri: p.track?.uri });
    }
    // Play-only playlist: Spotify won't list its tracks, so collect them as they play from it.
    if (status === "context" && p.track && contextUri === playlist?.uri && indexOfTrack(tracks, p.track) < 0) {
      tracks = [...tracks, p.track];
      set({ tracks });
      remember(playlistId, { discovered: tracks.slice(-DISCOVERED_CAP).map(slimTrack) });
    }
    const index = indexOfTrack(tracks, p.track);
    set({ ...p, ...clock, contextUri, ...(index >= 0 && { activeIndex: index, playingFrom: null }) });
    rememberProgress();
    // Once per track, not on every poll, and after a beat so Spotify's queue has caught up.
    if (p.track?.uri !== prevUri) {
      setTimeout(discoverFromQueue, 1500);
      tickListen(); // log the old track, start timing the new one
    }
  };

  // Play the selected playlist as a Spotify context, optionally from a given track and position.
  const playContext = (trackUri, positionMs = 0) => {
    const { playlist, activeDeviceId, sdkDeviceId, sdkPlayer } = get();
    if (!playlist?.uri) return;
    sdkPlayer?.activateElement?.();
    const base = { device_id: activeDeviceId ?? sdkDeviceId ?? undefined, context_uri: playlist.uri };
    return command({ isPlaying: true, playingFrom: null }, async () => {
      if (!trackUri) return player.play(base);
      try {
        await player.play({ ...base, offset: { uri: trackUri }, position_ms: positionMs });
      } catch (e) {
        if ([401, 403, 429].includes(e?.statusCode)) throw e;
        await player.play(base); // the saved track may have left the playlist: start from the top
      }
    });
  };

  return {
    // Library
    userId: null, // Spotify user id; decides which playlists expose their tracks
    playlists: [],
    playlistId: null,
    playlist: null,
    tracks: [],
    activeIndex: 0,
    status: "idle", // idle | loading | ready | context (play-only: not the user's) | empty | error
    resume: null, // { uri, positionMs } saved for the selected playlist, used when starting from idle

    // Playback, as Spotify reports it
    track: null, // what is actually playing; null when nothing is
    contextUri: null, // the playlist/album Spotify is playing from, if any
    isPlaying: false,
    positionMs: 0,
    positionAt: 0,
    seekAt: 0, // when the user last seeked, until Spotify confirms; see reconcilePosition
    volumeHoldUntil: 0, // set by setVolume(); polls don't overwrite the volume until then
    durationMs: 0,
    volume: 0.5,
    shuffle: false,
    repeat: "off",

    // Devices
    sdkPlayer: null,
    sdkDeviceId: null, // this tab, once the Web Playback SDK is ready
    activeDeviceId: null, // whichever device Spotify is playing on

    notice: null,
    lastCommandAt: 0,
    lastIdlePollAt: 0,

    loadPlaylists: async (userId) => {
      set({ userId });
      if (get().playlists.length) return;
      try {
        const body = await apiGet("/me/playlists?limit=50");
        const items = body.items ?? [];
        set({ playlists: items });
        if (get().playlistId) return;
        // Reopen where the user left off; otherwise start on one of their own playlists with tracks,
        // since only those expose their track list.
        const savedId = readResume(userId).playlistId;
        if (savedId && isCollectionKey(savedId)) return get().selectPlaylist(savedId);
        const preferred =
          items.find((p) => p.id === savedId) ??
          items.find((p) => canReadItems(p, userId) && playlistTotal(p) > 0) ??
          items.find((p) => canReadItems(p, userId)) ??
          items[0];
        if (preferred) get().selectPlaylist(preferred.id);
        else set({ status: "empty" });
      } catch (e) {
        console.error("Failed to load user playlists", e?.body ?? e);
        set({ status: "error" });
      }
    },

    selectPlaylist: async (id) => {
      rememberProgress(); // the position in the playlist we're leaving
      set({ playlistId: id, status: "loading", tracks: [], activeIndex: 0, resume: null });
      writeResume(get().userId, (r) => ({ ...r, playlistId: id }));
      const saved = readResume(get().userId).playlists?.[id] ?? {};
      const stale = () => get().playlistId !== id; // user picked another playlist meanwhile

      // Nothing playing: show the saved track's position, so the bar reads "2:13 / 3:40", not 0:00.
      const showSaved = (track) => {
        if (get().track || !track) return;
        set({ positionMs: saved.positionMs ?? 0, positionAt: Date.now(), durationMs: track.durationMs ?? 0, isPlaying: false });
      };

      // A full track list is in hand: pick the playing, else the saved, track.
      const showTracks = (playlist, tracks) => {
        const playingIndex = indexOfTrack(tracks, get().track);
        const savedIndex = tracks.findIndex((t) => t.uri === saved.uri);
        set({
          playlist,
          tracks,
          activeIndex: playingIndex >= 0 ? playingIndex : Math.max(0, savedIndex),
          status: tracks.length ? "ready" : "empty",
          resume: savedIndex >= 0 ? { uri: saved.uri, positionMs: saved.positionMs ?? 0 } : null,
        });
        if (playingIndex < 0) showSaved(tracks[savedIndex]);
      };

      try {
        if (isCollectionKey(id)) {
          const { meta, raw } = await loadCollection(id);
          if (stale()) return;
          const seen = new Set(); // recently played repeats tracks
          return showTracks(meta, raw.map(normalizeTrack).filter((t) => t?.id && !seen.has(t.uri) && seen.add(t.uri)));
        }

        const meta = { body: await apiGet(`/playlists/${id}`) };
        if (stale()) return;
        // Not the user's: Spotify returns metadata only, but it can still be played as a context.
        if (!canReadItems(meta.body, get().userId)) {
          const tracks = saved.discovered ?? []; // what earlier sessions collected
          const savedIndex = tracks.findIndex((t) => t.uri === saved.uri);
          set({
            playlist: meta.body,
            tracks,
            activeIndex: Math.max(0, savedIndex),
            status: "context",
            resume: saved.uri ? { uri: saved.uri, positionMs: saved.positionMs ?? 0 } : null,
          });
          showSaved(tracks[savedIndex]);
          // If it's already playing, show that track and what's coming up now.
          await get().syncFromApi({ force: true });
          return discoverFromQueue();
        }

        let collected = [];
        try {
          const limit = 50;
          for (let offset = 0; offset < TRACK_LIMIT; offset += limit) {
            const page = await getPlaylistItems(id, offset, limit);
            const items = page.items ?? [];
            collected.push(...items);
            if (items.length < limit || collected.length >= (page.total ?? 0)) break;
          }
        } catch (itemsErr) {
          console.warn("Playlist items failed, falling back to the embedded page", itemsErr?.statusCode, itemsErr?.body ?? itemsErr);
          if (canReadItems(meta.body, get().userId))
            set({ notice: `Spotify refused this playlist’s tracks (HTTP ${itemsErr?.statusCode ?? "?"}).` });
          collected = meta.body?.items?.items ?? meta.body?.tracks?.items ?? [];
        }
        if (stale()) return;

        showTracks(meta.body, collected.map((i) => normalizeTrack(entryTrack(i))).filter((t) => t?.id));
      } catch (e) {
        console.error("Failed to load playlist", e?.body ?? e);
        if (!stale()) set({ status: "error" });
      }
    },

    playContext,

    playIndex: (i, positionMs = 0) => {
      const { tracks, activeDeviceId, sdkDeviceId, sdkPlayer, status } = get();
      if (status === "context") return playContext(tracks[i]?.uri, positionMs);
      if (i < 0 || i >= tracks.length) return;
      sdkPlayer?.activateElement?.(); // some browsers only allow audio after a user gesture
      const t = tracks[i];
      return command(
        { activeIndex: i, track: t, isPlaying: true, positionMs, positionAt: Date.now(), durationMs: t.durationMs ?? 0, playingFrom: null },
        // The whole list goes in as the queue, so Spotify's own next/shuffle/repeat work on it.
        () =>
          player.play({
            device_id: activeDeviceId ?? sdkDeviceId ?? undefined,
            uris: tracks.map((x) => x.uri),
            offset: { position: i },
            position_ms: positionMs,
          })
      );
    },

    // Start from idle where the user left off: the saved track and position, if any.
    resumePlayback: () => {
      const { status, resume, tracks, activeIndex } = get();
      if (status === "context") return playContext(resume?.uri, resume?.positionMs);
      const atSaved = resume && tracks[activeIndex]?.uri === resume.uri;
      return get().playIndex(activeIndex, atSaved ? resume.positionMs : 0);
    },

    // Called on pagehide: the last poll may be seconds old.
    rememberProgress,

    togglePlay: () => {
      const s = get();
      s.sdkPlayer?.activateElement?.();
      if (!s.track) return s.resumePlayback();
      return s.isPlaying
        ? command({ isPlaying: false, positionMs: currentPosition(s), positionAt: Date.now() }, () => player.pause())
        : command({ isPlaying: true, positionAt: Date.now() }, () => player.play());
    },

    next: () => {
      const s = get();
      if (s.track) return command({}, () => player.next());
      return s.status === "context" ? playContext() : s.playIndex(s.activeIndex + 1);
    },
    prev: () => {
      const s = get();
      if (s.track) return command({}, () => player.previous());
      return s.status === "context" ? playContext() : s.playIndex(s.activeIndex - 1);
    },

    // seekAt: the bar stays where the user put it until Spotify confirms (see reconcilePosition).
    seek: (ms) =>
      command({ positionMs: ms, positionAt: Date.now(), seekAt: Date.now() }, () => player.seek(ms)),
    // volumeHoldUntil: like seek's hold, so a pre-change report doesn't flick the slider back.
    setVolume: (volume) =>
      command({ volume, volumeHoldUntil: Date.now() + VOLUME_HOLD_MS }, () => player.volume(volume * 100)),
    toggleShuffle: () => {
      const shuffle = !get().shuffle;
      return command({ shuffle }, () => player.shuffle(shuffle));
    },
    cycleRepeat: () => {
      const repeat = nextRepeat(get().repeat);
      return command({ repeat }, () => player.repeat(repeat));
    },

    // Play tracks that aren't the selected collection (search results), as their own queue.
    // `from`: where it was started, for the "Playing from" chip ({ label, artistId?, artistName? }).
    playTracks: (list, i = 0, from = null) => {
      const { activeDeviceId, sdkDeviceId, sdkPlayer } = get();
      const t = list[i];
      if (!t) return;
      sdkPlayer?.activateElement?.();
      return command(
        { track: t, isPlaying: true, positionMs: 0, positionAt: Date.now(), durationMs: t.durationMs ?? 0, playingFrom: from },
        () =>
          player.play({
            device_id: activeDeviceId ?? sdkDeviceId ?? undefined,
            uris: list.map((x) => x.uri),
            offset: { position: i },
          })
      );
    },

    addToQueue: async (track) => {
      try {
        await apiSend("POST", `/me/player/queue?${qs({ uri: track.uri })}`);
        set({ notice: `Added “${track.name}” to the queue.` });
      } catch (e) {
        set({ notice: explainError(e) });
      }
    },

    transferTo: (deviceId) =>
      command({ activeDeviceId: deviceId }, () => apiSend("PUT", "/me/player", { device_ids: [deviceId], play: true })),

    // Liked state per track uri, filled lazily for the playing track.
    liked: {},
    checkLiked: async (uri) => {
      if (!uri || uri in get().liked || isQuotaExceeded("library")) return; // known, or not worth the quota now
      try {
        const [isLiked] = await apiGet(`/me/library/contains?${qs({ uris: uri })}`);
        set((s) => ({ liked: { ...s.liked, [uri]: !!isLiked } }));
      } catch (e) {
        console.warn("Liked check failed", e?.body ?? e);
      }
    },
    toggleLike: async (track) => {
      const { uri } = track;
      const was = !!get().liked[uri];
      set((s) => ({ liked: { ...s.liked, [uri]: !was } }));
      try {
        await apiSend(was ? "DELETE" : "PUT", `/me/library?${qs({ uris: uri })}`);
      } catch (e) {
        set((s) => ({
          liked: { ...s.liked, [uri]: was },
          // Sessions from before user-library-modify was added lack the scope.
          notice: e?.statusCode === 403 ? "Saving needs a new permission: sign out and sign in again." : explainError(e),
        }));
      }
    },

    // Play an artist (or album) as a Spotify context: for an artist that's their popular songs, which
    // also stands in for the top-tracks endpoint Dev Mode removed.
    playUri: (contextUri, from = null) => {
      const { activeDeviceId, sdkDeviceId, sdkPlayer } = get();
      sdkPlayer?.activateElement?.();
      return command({ isPlaying: true, playingFrom: from }, () =>
        player.play({ device_id: activeDeviceId ?? sdkDeviceId ?? undefined, context_uri: contextUri })
      );
    },

    // Artist page (full screen, over the player). Also a history entry, so the browser's Back closes it.
    artistId: null,
    artistName: null, // known from where it was opened, so the page has a title before (or without) the API
    openArtist: (artistId, artistName = null) => {
      if (typeof window !== "undefined" && history.state?.artistId !== artistId)
        history.pushState({ artistId, artistName }, "", `#artist/${artistId}`); // name: the page's details are looked up by it
      set({ artistId, artistName, drawer: null });
    },
    closeArtist: () => {
      if (typeof window !== "undefined" && history.state?.artistId) return history.back(); // popstate clears it
      set({ artistId: null });
    },

    // Remembered across reloads: lyrics left open stay open.
    lyricsOpen: readUiState().lyricsOpen ?? false,
    toggleLyrics: () => {
      const lyricsOpen = !get().lyricsOpen;
      set({ lyricsOpen });
      writeUiState({ lyricsOpen });
    },

    // The lyrics settings panel stays open across reloads if it was left open.
    lyricsSettingsOpen: readUiState().lyricsSettingsOpen ?? false,
    toggleLyricsSettings: () => {
      const lyricsSettingsOpen = !get().lyricsSettingsOpen;
      set({ lyricsSettingsOpen });
      writeUiState({ lyricsSettingsOpen });
    },

    // Full-screen ambient mode (components/ambient.jsx).
    ambientOpen: false,
    toggleAmbient: () => set((st) => ({ ambientOpen: !st.ambientOpen })),

    // Desktop notification for each new song while the tab is in the background (usePlayback).
    songNotifications: readUiState().songNotifications ?? false,
    toggleSongNotifications: async () => {
      if (get().songNotifications) {
        set({ songNotifications: false });
        return writeUiState({ songNotifications: false });
      }
      if (typeof Notification === "undefined") return set({ notice: "This browser can’t show notifications." });
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted")
        return set({ notice: "Notifications are blocked for this site. Allow them in the browser’s site settings." });
      set({ songNotifications: true, notice: "You’ll get a notification for each new song while Musify is in the background." });
      writeUiState({ songNotifications: true });
    },

    // Where the playing music was started when it isn't the selected collection (artist page,
    // search); cleared once something from the collection plays.
    playingFrom: null,
    lyricsSettings: readLyricsSettings(),
    setLyricsSetting: (key, value) => {
      const lyricsSettings = { ...get().lyricsSettings, [key]: value };
      set({ lyricsSettings });
      try {
        localStorage.setItem(LYRICS_SETTINGS_KEY, JSON.stringify(lyricsSettings));
      } catch {}
    },

    tickListen,

    // Keyboard nudges update the UI at once and tell Spotify after a short pause, so holding a key
    // doesn't fire a request per repeat (the Dev Mode rate limit is small).
    nudgeVolume: (delta) => {
      set((s) => ({ volume: clamp(s.volume + delta, 0, 1), volumeHoldUntil: Date.now() + VOLUME_HOLD_MS }));
      clearTimeout(volumeTimer);
      volumeTimer = setTimeout(() => get().setVolume(get().volume), 350);
    },
    mutedFrom: 0,
    toggleMute: () => {
      const s = get();
      if (s.volume > 0) {
        set({ mutedFrom: s.volume });
        s.setVolume(0);
      } else s.setVolume(s.mutedFrom || 0.5);
    },
    seekBy: (deltaMs) => {
      const s = get();
      if (!s.track || !s.durationMs) return;
      const target = clamp(currentPosition(s) + deltaMs, 0, s.durationMs - 1000);
      set({ positionMs: target, positionAt: Date.now(), seekAt: Date.now() });
      clearTimeout(seekTimer);
      seekTimer = setTimeout(() => get().seek(currentPosition(get())), 350);
    },

    // Sleep timer: { at } (a time) or { endOfTrack: true }; usePlayback pauses when it's due.
    sleep: null,
    setSleep: (minutes) =>
      set({ sleep: minutes === "track" ? { endOfTrack: true } : minutes ? { at: Date.now() + minutes * 60_000 } : null }),

    helpOpen: false,
    toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),

    // Floating mini player (Document Picture-in-Picture, Chrome/Edge): a window that stays on top.
    pipWindow: null,
    openPip: async () => {
      if (get().pipWindow) return get().pipWindow.focus();
      if (typeof window === "undefined" || !("documentPictureInPicture" in window))
        return set({ notice: "This browser can’t pop out a mini player. Chrome or Edge can." });
      try {
        const pip = await window.documentPictureInPicture.requestWindow({ width: 320, height: 420 });
        // The new window starts blank: bring the page's styles (Tailwind, fonts) along.
        for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) {
          const copy = node.cloneNode(true);
          if (node.href) copy.href = node.href; // absolute: the pop-out has no base URL of ours
          pip.document.head.appendChild(copy);
        }
        pip.document.documentElement.style.colorScheme = "dark";
        pip.addEventListener("pagehide", () => set({ pipWindow: null }));
        set({ pipWindow: pip });
      } catch (e) {
        console.warn("Mini player failed", e);
      }
    },
    closePip: () => get().pipWindow?.close(),

    // Side panel: { view: "search" | "queue" | "artist" | "stats", artistId? } or null.
    drawer: null,
    openDrawer: (view, extra) => set({ drawer: { view, ...extra } }),
    closeDrawer: () => set({ drawer: null }),

    syncFromApi: async ({ force = false } = {}) => {
      const settling = () => !force && Date.now() - get().lastCommandAt < POLL_GRACE_MS;
      if (!spotifyAuth.getAccessToken() || settling()) return;
      try {
        // Playing in this tab: ask the SDK, not the Web API. It's free (no quota, no rate limit), so
        // it runs even while Spotify makes us wait. Both report the position as of the last state
        // change (e.g. the seek target), not now, so a poll would yank the bar back to it: positions
        // come from SDK events instead; the poll only notices a new track or another device taking over.
        const { sdkPlayer, sdkDeviceId, activeDeviceId } = get();
        if (sdkPlayer && sdkDeviceId && activeDeviceId === sdkDeviceId) {
          const state = await sdkPlayer.getCurrentState();
          if (state) {
            if (settling()) return;
            const newTrack = state.track_window.current_track?.uri !== get().track?.uri;
            return get().applySdkState(state, { withPosition: newTrack });
          }
          // null: another device took over; fall through to the Web API.
        }
        // The Web API costs quota: wait out a backoff or the player bucket's quota pause.
        if (!force && (isRateLimited() || isQuotaExceeded("player"))) return;
        // Nothing playing anywhere: poll a third as often.
        if (!force && !get().track && Date.now() - get().lastIdlePollAt < IDLE_POLL_MS) return;
        if (!get().track) set({ lastIdlePollAt: Date.now() });
        const body = await player.state();
        if (settling()) return;
        if (!body?.device) return set({ track: null, contextUri: null, isPlaying: false, activeDeviceId: null });
        applyPlayback({
          track: normalizeTrack(body.item),
          isPlaying: body.is_playing,
          positionMs: body.progress_ms ?? 0,
          durationMs: body.item?.duration_ms ?? 0,
          shuffle: body.shuffle_state,
          repeat: body.repeat_state,
          activeDeviceId: body.device.id,
          contextUri: body.context?.uri ?? null,
          ...(body.device.volume_percent != null &&
            Date.now() > get().volumeHoldUntil && { volume: body.device.volume_percent / 100 }),
        });
      } catch (e) {
        console.warn("Playback state sync failed", e?.body ?? e);
      }
    },

    // withPosition: false for polls (their position is stale, see syncFromApi); events carry a fresh one.
    applySdkState: (s, { withPosition = true } = {}) =>
      applyPlayback({
        track: normalizeTrack(s.track_window.current_track),
        isPlaying: !s.paused,
        ...(withPosition && { positionMs: s.position }),
        durationMs: s.duration,
        shuffle: s.shuffle,
        repeat: REPEAT_MODES[s.repeat_mode] ?? "off",
        activeDeviceId: get().sdkDeviceId,
        contextUri: s.context?.uri ?? null,
      }),
  };
});
