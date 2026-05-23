export type CaseListCopyTarget = "caseId" | "caseName";

interface CaseListCopyMeta {
  title: string;
  successMessage: string;
}

const copyTargetLabels: Record<CaseListCopyTarget, string> = {
  caseId: "caseId",
  caseName: "名称"
};

export function createCaseListCopyMeta(target: CaseListCopyTarget, value: string): CaseListCopyMeta {
  const label = copyTargetLabels[target];
  const titlePrefix = target === "caseId" ? `点击复制 ${label}` : `点击复制${label}`;
  return {
    title: `${titlePrefix}：${value}`,
    successMessage: target === "caseId" ? `${label} 已复制` : `${label}已复制`
  };
}
