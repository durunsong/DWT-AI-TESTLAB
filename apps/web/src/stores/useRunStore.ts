import { create } from "zustand";
import type { RunStatus, StepResult, TestRunSummary } from "../types/run";

interface RunState {
  runId: string;
  caseId: string;
  status: RunStatus | "idle";
  currentStep: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  logs: string[];
  run?: TestRunSummary;
  currentBatchId: string;
  setRun: (data: Partial<RunState>) => void;
  setSummary: (run: TestRunSummary) => void;
  setCurrentBatchId: (batchId: string) => void;
  updateStep: (step: StepResult) => void;
  updateSteps: (steps: StepResult[]) => void;
  appendLog: (log: string) => void;
  setLogs: (logs: string | string[]) => void;
  reset: () => void;
}

const runStorageKey = "dwt-testing-run-state";

const initial = {
  runId: "",
  caseId: "",
  status: "idle" as const,
  currentStep: "",
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  logs: [] as string[],
  run: undefined,
  currentBatchId: loadSavedCurrentBatchId()
};

export const useRunStore = create<RunState>((set) => ({
  ...initial,
  setRun: (data) => set(data),
  setSummary: (run) =>
    set({
      run,
      runId: run.runId,
      caseId: run.caseId,
      status: run.status,
      currentStep: run.currentStep ?? "",
      total: run.total,
      passed: run.passed,
      failed: run.failed,
      skipped: run.skipped
    }),
  setCurrentBatchId: (batchId) => {
    saveCurrentBatchId(batchId);
    set({ currentBatchId: batchId });
  },
  updateStep: (step) => set((state) => mergeStepUpdates(state, [step])),
  updateSteps: (steps) => set((state) => mergeStepUpdates(state, steps)),
  appendLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  setLogs: (logs) => set({ logs: Array.isArray(logs) ? logs : logs.split(/\r?\n/) }),
  reset: () => set((state) => ({ ...initial, currentBatchId: state.currentBatchId }))
}));

function mergeStepUpdates(state: RunState, updates: StepResult[]): Partial<RunState> | RunState {
  const current = state.run;
  if (!current || !updates.length) return state;

  const stepMap = new Map(current.steps.map((step) => [step.stepId, step]));
  for (const step of updates) {
    stepMap.set(step.stepId, step);
  }
  const steps = Array.from(stepMap.values());
  const passed = steps.filter((item) => item.status === "passed").length;
  const failed = steps.filter((item) => item.status === "failed").length;
  const skipped = steps.filter((item) => item.status === "skipped").length;
  const currentStep = updates[updates.length - 1]?.stepId ?? state.currentStep;

  return {
    run: { ...current, steps, currentStep, total: steps.length, passed, failed, skipped },
    currentStep,
    total: steps.length,
    passed,
    failed,
    skipped
  };
}

function loadSavedCurrentBatchId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const raw = window.localStorage.getItem(runStorageKey);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { currentBatchId?: unknown };
    return typeof parsed.currentBatchId === "string" ? parsed.currentBatchId : "";
  } catch {
    return "";
  }
}

function saveCurrentBatchId(batchId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!batchId) {
      window.localStorage.removeItem(runStorageKey);
      return;
    }
    window.localStorage.setItem(runStorageKey, JSON.stringify({ currentBatchId: batchId }));
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
}
