import assert from "node:assert/strict";
import test from "node:test";
import { shouldUseReactStrictMode } from "./react-strict-mode";

test("keeps React StrictMode off by default for faster local debugging", () => {
  assert.equal(shouldUseReactStrictMode(undefined), false);
  assert.equal(shouldUseReactStrictMode("false"), false);
  assert.equal(shouldUseReactStrictMode(false), false);
  assert.equal(shouldUseReactStrictMode("true"), true);
  assert.equal(shouldUseReactStrictMode(true), true);
});
