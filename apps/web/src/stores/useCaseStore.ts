import { create } from "zustand";
import type { CaseDetail, CaseItem, CaseValidationResult } from "../types/case";

interface CaseState {
  cases: CaseItem[];
  activeCase?: CaseDetail;
  yaml: string;
  validation?: CaseValidationResult;
  setCases: (cases: CaseItem[]) => void;
  setActiveCase: (activeCase: CaseDetail) => void;
  setYaml: (yaml: string) => void;
  setValidation: (validation: CaseValidationResult | undefined) => void;
}

export const useCaseStore = create<CaseState>((set) => ({
  cases: [],
  yaml: "",
  setCases: (cases) => set({ cases }),
  setActiveCase: (activeCase) => set({ activeCase, yaml: activeCase.content }),
  setYaml: (yaml) => set({ yaml }),
  setValidation: (validation) => set({ validation })
}));
