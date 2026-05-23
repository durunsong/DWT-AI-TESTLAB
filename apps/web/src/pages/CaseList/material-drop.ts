interface ResolveCreateCaseMaterialDropInput {
  createOpen: boolean;
  createMode: "template" | "ai";
  creating: boolean;
}

export interface CreateCaseMaterialDropCopy {
  title: string;
  description: string;
}

export function canAcceptCreateCaseMaterialDrop(input: ResolveCreateCaseMaterialDropInput): boolean {
  return input.createOpen && input.createMode === "ai" && !input.creating;
}

export function createCaseMaterialDropCopy(): CreateCaseMaterialDropCopy {
  return {
    title: "导入到新增用例资料",
    description: "AI 会读取文档、图片或流程图，用于生成当前新增用例草稿。"
  };
}
