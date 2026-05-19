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
  setRun: (data: Partial<RunState>) => void;
  setSummary: (run: TestRunSummary) => void;
  updateStep: (step: StepResult) => void;
  appendLog: (log: string) => void;
  setLogs: (logs: string | string[]) => void;
  reset: () => void;
}

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
  run: undefined
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
  updateStep: (step) =>
    set((state) => {
      const current = state.run;
      if (!current) return state;
      const steps = current.steps.some((item) => item.stepId === step.stepId)
        ? current.steps.map((item) => (item.stepId === step.stepId ? step : item))
        : [...current.steps, step];
      const passed = steps.filter((item) => item.status === "passed").length;
      const failed = steps.filter((item) => item.status === "failed").length;
      const skipped = steps.filter((item) => item.status === "skipped").length;
      return {
        run: { ...current, steps, currentStep: step.stepId, total: steps.length, passed, failed, skipped },
        currentStep: step.stepId,
        total: steps.length,
        passed,
        failed,
        skipped
      };
    }),
  appendLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  setLogs: (logs) => set({ logs: Array.isArray(logs) ? logs : logs.split(/\r?\n/) }),
  reset: () => set(initial)
}));
