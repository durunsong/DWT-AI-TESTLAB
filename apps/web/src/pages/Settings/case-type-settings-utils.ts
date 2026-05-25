import type { CaseTypeConfig } from "../../types/settings";

export function updateCaseTypeAt(items: CaseTypeConfig[], index: number, patch: Partial<CaseTypeConfig>): CaseTypeConfig[] {
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
}

export function addEmptyCaseType(items: CaseTypeConfig[]): CaseTypeConfig[] {
  return [
    ...items,
    {
      key: "",
      label: "",
      enabled: true,
      sort: (items.at(-1)?.sort ?? 0) + 10
    }
  ];
}
