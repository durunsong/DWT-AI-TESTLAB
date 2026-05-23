export type CaseEditorDropTarget = "caseAttachment" | "aiInstruction";

interface ResolveCaseEditorDropTargetInput {
  aiOpen: boolean;
  attachmentUploading: boolean;
  aiInstructionUploading: boolean;
}

export interface CaseEditorDropCopy {
  title: string;
  description: string;
}

export function resolveCaseEditorDropTarget(input: ResolveCaseEditorDropTargetInput): CaseEditorDropTarget | undefined {
  if (input.aiOpen) {
    return input.aiInstructionUploading ? undefined : "aiInstruction";
  }

  return input.attachmentUploading ? undefined : "caseAttachment";
}

export function hasFileDrag(types: Iterable<string> | undefined): boolean {
  if (!types) {
    return false;
  }

  for (const type of types) {
    if (type === "Files") {
      return true;
    }
  }
  return false;
}

export function caseEditorDropCopy(target: CaseEditorDropTarget): CaseEditorDropCopy {
  if (target === "aiInstruction") {
    return {
      title: "上传到 AI 对话资料",
      description: "只用于当前 AI YAML 助手，不保存为测试附件。"
    };
  }

  return {
    title: "上传到测试附件",
    description: "保存到当前用例附件目录，可引用到 YAML 的 web_upload 步骤。"
  };
}
