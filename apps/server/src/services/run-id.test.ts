import assert from "node:assert/strict";
import test from "node:test";
import { formatRunId, getNextRunSequence } from "./run-id";

test("gets next sequence from existing numbered run folders", () => {
  assert.equal(getNextRunSequence(["0001_login_user_ab12", "0007_login_admin_cd34", "run_old"]), 8);
});

test("uses first sequence when there are no numbered run folders", () => {
  assert.equal(getNextRunSequence(["run_old", "notes"]), 1);
});

test("formats run id with four digit sequence and safe case id", () => {
  const runId = formatRunId(12, "login/user");

  assert.match(runId, /^0012_login_user_[0-9a-z]+$/);
});
