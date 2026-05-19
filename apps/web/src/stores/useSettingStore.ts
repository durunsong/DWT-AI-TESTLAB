import { create } from "zustand";
import type { TestEnv } from "../types/settings";

interface SettingState {
  env: TestEnv;
  headless: boolean;
  slowMo: number;
  trace: boolean;
  screenshot: boolean;
  setEnv: (env: TestEnv) => void;
  setHeadless: (headless: boolean) => void;
  setSlowMo: (slowMo: number) => void;
  setTrace: (trace: boolean) => void;
  setScreenshot: (screenshot: boolean) => void;
}

const saved = readSettings();

export const useSettingStore = create<SettingState>((set) => ({
  env: saved.env ?? "local",
  headless: saved.headless ?? false,
  slowMo: saved.slowMo ?? 100,
  trace: saved.trace ?? true,
  screenshot: saved.screenshot ?? true,
  setEnv: (env) => setAndPersist(set, { env }),
  setHeadless: (headless) => setAndPersist(set, { headless }),
  setSlowMo: (slowMo) => setAndPersist(set, { slowMo }),
  setTrace: (trace) => setAndPersist(set, { trace }),
  setScreenshot: (screenshot) => setAndPersist(set, { screenshot })
}));

function setAndPersist(set: (partial: Partial<SettingState>) => void, partial: Partial<SettingState>) {
  set(partial);
  const current = { ...readSettings(), ...partial };
  window.localStorage.setItem("ai-e2e-settings", JSON.stringify(current));
}

function readSettings(): Partial<SettingState> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem("ai-e2e-settings") || "{}") as Partial<SettingState>;
  } catch {
    return {};
  }
}
