import assert from "node:assert/strict";
import test from "node:test";
import type { StepResult } from "../../types/run";
import { createStepUpdateBatcher } from "./step-update-batcher";

test("flushes every changed step once instead of keeping only the last event", () => {
  let scheduled: (() => void) | undefined;
  const flushed: string[] = [];
  const batcher = createStepUpdateBatcher({
    schedule: (callback) => {
      scheduled = callback;
      return 1;
    },
    cancel: () => undefined,
    onStep: (step) => {
      flushed.push(`${step.stepId}:${step.status}`);
    }
  });

  batcher.enqueue(step("open_page", "running"));
  batcher.enqueue(step("open_page", "passed"));
  batcher.enqueue(step("click_save", "running"));
  scheduled?.();

  assert.deepEqual(flushed, ["open_page:passed", "click_save:running"]);
});

function step(stepId: string, status: StepResult["status"]): StepResult {
  return {
    stepId,
    name: stepId,
    type: "web_click",
    status
  };
}
