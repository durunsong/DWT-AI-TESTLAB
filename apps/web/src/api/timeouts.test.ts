import assert from "node:assert/strict";
import test from "node:test";
import { AI_REQUEST_OPTIONS, AI_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS } from "./timeouts";

test("keeps normal requests short and gives AI requests a 60s timeout", () => {
  assert.equal(DEFAULT_REQUEST_TIMEOUT_MS, 20_000);
  assert.equal(AI_REQUEST_TIMEOUT_MS, 60_000);
  assert.equal(AI_REQUEST_OPTIONS.timeout, 60_000);
});
