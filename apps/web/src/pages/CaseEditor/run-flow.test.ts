import assert from "node:assert/strict";
import test from "node:test";
import { runCaseAfterSave } from "./run-flow";

test("saves the current yaml before preflight and run", async () => {
  const calls: string[] = [];

  const result = await runCaseAfterSave({
    validate: async () => {
      calls.push("validate");
      return { valid: true };
    },
    save: async () => {
      calls.push("save");
      return { saved: true };
    },
    preflight: async () => {
      calls.push("preflight");
      return { runnable: true };
    },
    start: async () => {
      calls.push("start");
      return { runId: "0001_demo" };
    }
  });

  assert.deepEqual(calls, ["validate", "save", "preflight", "start"]);
  assert.deepEqual(result, { status: "started", runId: "0001_demo" });
});

test("does not run when save fails", async () => {
  const calls: string[] = [];

  const result = await runCaseAfterSave({
    validate: async () => {
      calls.push("validate");
      return { valid: true };
    },
    save: async () => {
      calls.push("save");
      return { saved: false };
    },
    preflight: async () => {
      calls.push("preflight");
      return { runnable: true };
    },
    start: async () => {
      calls.push("start");
      return { runId: "0001_demo" };
    }
  });

  assert.deepEqual(calls, ["validate", "save"]);
  assert.deepEqual(result, { status: "save_failed" });
});
