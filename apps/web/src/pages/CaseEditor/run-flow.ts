export type RunCaseFlowResult =
  | { status: "validation_failed" }
  | { status: "save_failed" }
  | { status: "preflight_failed" }
  | { status: "started"; runId: string };

export interface RunCaseFlowActions {
  validate: () => Promise<{ valid: boolean }>;
  save: () => Promise<{ saved: boolean }>;
  preflight: () => Promise<{ runnable: boolean } | undefined>;
  start: () => Promise<{ runId: string }>;
}

export async function runCaseAfterSave(actions: RunCaseFlowActions): Promise<RunCaseFlowResult> {
  const validation = await actions.validate();
  if (!validation.valid) {
    return { status: "validation_failed" };
  }

  const saved = await actions.save();
  if (!saved.saved) {
    return { status: "save_failed" };
  }

  const preflight = await actions.preflight();
  if (!preflight?.runnable) {
    return { status: "preflight_failed" };
  }

  const run = await actions.start();
  return { status: "started", runId: run.runId };
}
