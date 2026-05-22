import assert from "node:assert/strict";
import test from "node:test";
import { AI_MATERIAL_DRAFT_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS } from "./timeouts";

test("keeps normal requests short and allows AI material draft to run longer", () => {
  assert.equal(DEFAULT_REQUEST_TIMEOUT_MS, 20_000);
  assert.equal(AI_MATERIAL_DRAFT_TIMEOUT_MS, 120_000);
});
