import type { SessionName } from "../constants/session";
import type { ScenarioStep } from "./step";

export type ScenarioMode = "web" | "hybrid";

export interface ScenarioSession {
  name: SessionName;
  login_url: string;
  username?: string;
  password?: string;
}

export interface ScenarioCase {
  case_id: string;
  case_name: string;
  description?: string;
  mode: ScenarioMode;
  sessions: ScenarioSession[];
  variables?: Record<string, string>;
  locations: {
    file: string;
  };
  steps: ScenarioStep[];
}

export type LocatorFallback =
  | { role: string; name?: string }
  | { label: string }
  | { placeholder: string }
  | { text: string }
  | { name: string }
  | { css: string }
  | { xpath: string };

export interface LocationDefinition {
  testId?: string;
  role?: string;
  label?: string;
  placeholder?: string;
  text?: string;
  name?: string;
  css?: string;
  xpath?: string;
  fallback?: LocatorFallback[];
}

export type LocationMap = Record<string, LocationDefinition>;
