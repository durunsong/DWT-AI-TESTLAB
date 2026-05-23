import assert from "node:assert/strict";
import test from "node:test";
import { playTypewriterText } from "./typewriter-text";

test("reveals text in scheduled chunks", async () => {
  const callbacks: Array<() => void> = [];
  const values: string[] = [];
  const delays: number[] = [];
  const typing = playTypewriterText("abcdef", {
    charsPerFrame: 2,
    schedule: (callback, delayMs) => {
      callbacks.push(callback);
      delays.push(delayMs);
      return callbacks.length;
    },
    cancel: () => undefined,
    onUpdate: (value) => values.push(value)
  });

  callbacks.shift()?.();
  callbacks.shift()?.();
  callbacks.shift()?.();
  await typing.done;

  assert.deepEqual(values, ["", "ab", "abcd", "abcdef"]);
  assert.deepEqual(delays, [0, 22, 22]);
});

test("finishes typewriter text immediately", async () => {
  const values: string[] = [];
  const typing = playTypewriterText("完整内容", {
    schedule: () => 1,
    cancel: () => undefined,
    onUpdate: (value) => values.push(value)
  });

  typing.finish();
  await typing.done;

  assert.deepEqual(values, ["", "完整内容"]);
});

test("reports typing state while playing", async () => {
  const callbacks: Array<() => void> = [];
  const typingStates: boolean[] = [];
  const typing = playTypewriterText("助手输出", {
    charsPerTick: 2,
    schedule: (callback) => {
      callbacks.push(callback);
      return callbacks.length;
    },
    cancel: () => undefined,
    onTypingChange: (typing) => typingStates.push(typing),
    onUpdate: () => undefined
  });

  callbacks.shift()?.();
  callbacks.shift()?.();
  await typing.done;

  assert.deepEqual(typingStates, [true, false]);
});
