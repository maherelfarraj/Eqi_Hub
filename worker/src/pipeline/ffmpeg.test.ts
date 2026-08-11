import assert from "node:assert/strict";
import test from "node:test";
import { frameTimestampsForDuration } from "./ffmpeg.js";

test("short clips yield four evenly ordered frames", () => {
  const timestamps = frameTimestampsForDuration(7.27);
  assert.equal(timestamps.length, 4);
  assert.ok(timestamps.every((value, index) => index === 0 || value > timestamps[index - 1]!));
  assert.ok(timestamps.at(-1)! < 7_270);
});

test("long clips are capped at twelve frames", () => {
  assert.equal(frameTimestampsForDuration(180).length, 12);
});
