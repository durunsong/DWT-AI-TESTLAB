import assert from "node:assert/strict";
import test from "node:test";
import { clampVideoTime, formatVideoTime, resolveVideoSliderValue } from "./video-player";

test("formats video time for controls", () => {
  assert.equal(formatVideoTime(0), "0:00");
  assert.equal(formatVideoTime(7.8), "0:07");
  assert.equal(formatVideoTime(67), "1:07");
  assert.equal(formatVideoTime(3661), "1:01:01");
  assert.equal(formatVideoTime(Number.NaN), "0:00");
});

test("clamps seek values to the available duration", () => {
  assert.equal(clampVideoTime(-3, 120), 0);
  assert.equal(clampVideoTime(43, 120), 43);
  assert.equal(clampVideoTime(130, 120), 120);
  assert.equal(clampVideoTime(20, Number.NaN), 20);
  assert.equal(clampVideoTime(Number.NaN, 120), 0);
});

test("keeps the dragged seek value visible while seeking", () => {
  assert.equal(resolveVideoSliderValue({ currentTime: 3, seekTime: 21, seeking: true, duration: 36 }), 21);
  assert.equal(resolveVideoSliderValue({ currentTime: 3, seekTime: 21, seeking: false, duration: 36 }), 3);
  assert.equal(resolveVideoSliderValue({ currentTime: 3, seekTime: 50, seeking: true, duration: 36 }), 36);
});
