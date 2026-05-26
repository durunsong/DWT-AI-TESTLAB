export type ManualSourceMode = "copy" | "builtin";

export type ManualCreateModeResult =
  | { kind: "copy"; sourceCaseId: string }
  | { kind: "builtin" }
  | { kind: "invalid"; message: string };

export function resolveManualCreateMode(input: { manualSource?: ManualSourceMode; sourceCaseId?: string }): ManualCreateModeResult {
  if (input.manualSource === "builtin") {
    return { kind: "builtin" };
  }

  const sourceCaseId = input.sourceCaseId?.trim();
  if (!sourceCaseId) {
    return {
      kind: "invalid",
      message: "请选择一个可用的用例来源"
    };
  }
  return {
    kind: "copy",
    sourceCaseId
  };
}
