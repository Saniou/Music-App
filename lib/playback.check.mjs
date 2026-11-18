// Run: npm run check
import assert from "node:assert/strict";
import { coverUrl, majorityTone, currentPosition, explainError, formatTime, indexOfTrack, matchesQuery, nextRepeat, normalizeTrack } from "./playback.js";

assert.equal(nextRepeat("off"), "context");
assert.equal(nextRepeat("track"), "off");

const api = normalizeTrack({ id: "a", uri: "spotify:track:a", name: "A", duration_ms: 1000 });
assert.equal(api.url, "https://open.spotify.com/track/a");
assert.equal(normalizeTrack({ id: "x" }), null);

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
