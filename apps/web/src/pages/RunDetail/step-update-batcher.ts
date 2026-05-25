import type { StepResult } from "../../types/run";

interface StepUpdateBatcherOptions {
  schedule: (callback: () => void) => number;
  cancel: (handle: number) => void;
  onStep: (step: StepResult) => void;
}

export interface StepUpdateBatcher {
  enqueue: (step: StepResult) => void;
  flush: () => void;
  cancel: () => void;
}

export function createStepUpdateBatcher(options: StepUpdateBatcherOptions): StepUpdateBatcher {
  const pendingSteps = new Map<string, StepResult>();
  let frame: number | undefined;

  function flush() {
    frame = undefined;
    const steps = [...pendingSteps.values()];
    pendingSteps.clear();
    for (const step of steps) {
      options.onStep(step);
    }
  }

  return {
    enqueue(step) {
      pendingSteps.set(step.stepId, step);
      if (frame === undefined) {
        frame = options.schedule(flush);
      }
    },
    flush,
    cancel() {
      if (frame !== undefined) {
        options.cancel(frame);
        frame = undefined;
      }
      pendingSteps.clear();
    }
  };
}
