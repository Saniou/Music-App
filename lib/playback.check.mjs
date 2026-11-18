// Run: npm run check
import assert from "node:assert/strict";
import { coverUrl, majorityTone, reconcilePosition, currentPosition, explainError, formatTime, indexOfTrack, matchesQuery, nextRepeat, normalizeTrack } from "./playback.js";

assert.equal(nextRepeat("off"), "context");
assert.equal(nextRepeat("track"), "off");

const api = normalizeTrack({ id: "a", uri: "spotify:track:a", name: "A", duration_ms: 1000 });
assert.equal(api.url, "https://open.spotify.com/track/a");
assert.equal(normalizeTrack({ id: "x" }), null);
// A Web Playback SDK track: artists and album carry uris but no ids.
const sdk = normalizeTrack({
  uri: "spotify:track:t1",
  name: "HELLBENT",
  artists: [{ name: "Wage War", uri: "spotify:artist:ww1" }],
  album: { name: "Stigma", uri: "spotify:album:al1", images: [] },
});
assert.equal(sdk.id, "t1");
assert.equal(sdk.artists[0].id, "ww1");
assert.equal(sdk.album.id, "al1");

const list = [api, normalizeTrack({ id: "b", uri: "spotify:track:b" })];
// SDK reports a relinked track: different uri, original in linked_from.
const relinked = normalizeTrack({ id: "c", uri: "spotify:track:c", linked_from: { uri: "spotify:track:b" } });
assert.equal(indexOfTrack(list, relinked), 1);
assert.equal(indexOfTrack(list, null), -1);

const s = { isPlaying: true, positionMs: 1000, positionAt: 5000, durationMs: 3000 };
assert.equal(currentPosition(s, 6500), 2500);
assert.equal(currentPosition(s, 99999), 3000); // clamped to duration
assert.equal(currentPosition(s, 4000), 1000); // clock behind the report: no going backwards
assert.equal(currentPosition({ ...s, isPlaying: false }, 99999), 1000);

{
  const prev = { trackUri: "t", isPlaying: true, positionMs: 60_000, positionAt: 0, durationMs: 300_000 };
  const at = (positionMs, positionAt = 10_000) => ({ ...prev, positionMs, positionAt });
  const kept = (r) => r.positionMs === prev.positionMs && r.positionAt === prev.positionAt;
  // At 10s the clock reads 1:10. Late or rounded reports within 3s: keep the clock, no visible jump.
  assert.ok(kept(reconcilePosition(prev, at(68_500), 10_000)));
  // A real jump (seek on another device), a pause, or a new track: take the report.
  assert.equal(reconcilePosition(prev, at(150_000), 10_000).positionMs, 150_000);
  assert.equal(reconcilePosition(prev, { ...at(70_000), isPlaying: false }, 10_000).isPlaying, false);
  assert.equal(reconcilePosition(prev, { ...at(0), trackUri: "u" }, 10_000).positionMs, 0);

  // Local seek to 2:00 at t=9s; at t=10s the clock reads 2:01.
  const seeked = { ...prev, positionMs: 120_000, positionAt: 9_000, seekAt: 9_000 };
  const heldSeek = (r) => r.positionMs === 120_000 && r.positionAt === 9_000 && r.isPlaying === true;
  // The pre-seek position (1:05) and the buffering pause are ignored; the lock stays...
  assert.ok(heldSeek(reconcilePosition(seeked, at(65_000), 10_000)));
  assert.equal(reconcilePosition(seeked, at(65_000), 10_000).seekAt, 9_000);
  assert.ok(heldSeek(reconcilePosition(seeked, { ...at(120_000), isPlaying: false }, 10_000)));
  // ...until a report agrees (lock released, bar untouched), or 8s pass without one.
  const confirmed = reconcilePosition(seeked, at(120_500), 10_000);
  assert.ok(heldSeek(confirmed) && confirmed.seekAt === 0);
  assert.equal(reconcilePosition(seeked, at(65_000, 18_000), 18_000).positionMs, 65_000);
}

assert.match(explainError({ statusCode: 404 }), /No active/);
assert.match(explainError({ statusCode: 403, body: { error: { reason: "PREMIUM_REQUIRED" } } }), /Premium/);
assert.equal(formatTime(65_000), "1:05");

const imgs = [{ url: "640", width: 640 }, { url: "300", width: 300 }, { url: "64", width: 64 }];
assert.equal(coverUrl(imgs, 168), "300");
assert.equal(coverUrl(imgs, 1000), "640"); // nothing big enough: the widest
assert.equal(coverUrl([{ url: "mosaic", width: null }], 80), "mosaic"); // playlist mosaics have no sizes
assert.equal(coverUrl([], 80), null);

const px = (...colors) => new Uint8ClampedArray(colors.flat());
assert.equal(majorityTone(px([255, 255, 255, 255], [250, 240, 230, 255], [0, 0, 0, 255])), "light");
assert.equal(majorityTone(px([10, 10, 10, 255], [40, 20, 60, 255], [255, 255, 255, 255])), "dark");
assert.equal(majorityTone(px([255, 255, 255, 0], [0, 0, 0, 255])), "dark"); // transparent ignored
assert.equal(majorityTone(px([0, 255, 0, 255])), "light"); // green is bright to the eye
assert.equal(majorityTone(px([0, 0, 255, 255])), "dark"); // blue is not

const song = { name: "Café Del Mar", artists: [{ name: "Energy 52" }], album: { name: "Remixes" } };
assert.ok(matchesQuery(song, "cafe"));
assert.ok(matchesQuery(song, "  energy   mar "));
assert.ok(matchesQuery(song, ""));
assert.ok(!matchesQuery(song, "cafe tiesto"));

console.log("playback helpers ok");

// Lyrics
import { activeLine, parseLrc } from "./lyrics.js";
const lrc = "[ar:Someone]\n[00:01.65] First\n[00:04.01] Second\n[01:02.5][02:10.00] Chorus\n\n[00:08.37]";
const lines = parseLrc(lrc);
assert.deepEqual(lines.map((l) => l.timeMs), [1650, 4010, 8370, 62500, 130000]);
assert.equal(lines[3].text, "Chorus"); // multi-stamp line appears at each time
assert.equal(lines[2].text, ""); // empty line keeps its slot (instrumental gap)
assert.equal(activeLine(lines, 0), -1);
assert.equal(activeLine(lines, 1650), 0);
assert.equal(activeLine(lines, 5000), 1);
assert.equal(activeLine(lines, 999_999), 4);
console.log("lyrics helpers ok");

// Word-synced lyrics (LRCLIB lyricsfile)
import { parseWordSync, wordEnd } from "./lyrics.js";
const yaml = `version: '1.0'
metadata:
  title: X
lines:
- text: I'm not afraid
  start_ms: 1500
  end_ms: 2311
  words:
  - text: 'I''m '
    start_ms: 1500
  - text: 'not '
    start_ms: 1695
  - text: afraid
    start_ms: 1961
- text: Second
  start_ms: 3870
  words:
  - text: Second
    start_ms: 3870`;
const wl = parseWordSync(yaml);
assert.equal(wl.length, 2);
assert.deepEqual(wl[0].words.map((w) => w.text), ["I'm ", "not ", "afraid"]); // quotes undone, spaces kept
assert.deepEqual([wl[0].timeMs, wl[0].endMs, wl[0].words[2].timeMs], [1500, 2311, 1961]);
assert.equal(wordEnd(wl, 0, 0), 1695); // next word
assert.equal(wordEnd(wl, 0, 2), 2311); // line end
assert.equal(wordEnd(wl, 1, 0), 4370); // no end anywhere: +0.5s
assert.equal(activeLine(wl, 3000), 0);
console.log("word sync ok");
