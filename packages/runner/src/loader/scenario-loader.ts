import fs from "node:fs/promises";
import path from "node:path";
import { scenarioCaseSchema, type ScenarioCase } from "@ai-e2e/shared";
import YAML from "yaml";
import { loadYamlFile } from "./yaml-loader";

const scenarioPhases = ["beforeActions", "mainSteps", "steps", "assertions", "afterActions"] as const;
type ScenarioPhase = (typeof scenarioPhases)[number];
type SharedStepPhase = Exclude<ScenarioPhase, "steps">;

export interface ScenarioValidationIssue {
  path: string;
  message: string;
}

export interface ScenarioValidationResult {
  valid: boolean;
  caseId?: string;
  caseName?: string;
  issues: ScenarioValidationIssue[];
  data?: ScenarioCase;
}

export function validateScenarioContent(content: string): ScenarioValidationResult {
  try {
    const raw = YAML.parse(content) as unknown;
    const normalized = normalizeScenarioShape(raw);
    const rawCaseId = readStringField(normalized, "case_id") ?? readStringField(raw, "caseId");
    const rawCaseName = readStringField(normalized, "case_name") ?? readStringField(raw, "caseName");
    const parsed = scenarioCaseSchema.safeParse(normalized);
    if (!parsed.success) {
      return {
        valid: false,
        caseId: rawCaseId,
        caseName: rawCaseName,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join(".") || "root",
          message: issue.message
        }))
      };
    }
    return {
      valid: true,
      caseId: parsed.data.case_id,
      caseName: parsed.data.case_name,
      issues: [],
      data: parsed.data
    };
  } catch (error) {
    return {
      valid: false,
      issues: [{ path: "yaml", message: error instanceof Error ? error.message : String(error) }]
    };
  }
}

export async function validateScenarioContentForRun(rootDir: string, content: string): Promise<ScenarioValidationResult> {
  try {
    const raw = YAML.parse(content) as unknown;
    const normalized = await normalizeScenarioForRun(rootDir, raw);
    const rawCaseId = readStringField(normalized, "case_id") ?? readStringField(raw, "caseId");
    const rawCaseName = readStringField(normalized, "case_name") ?? readStringField(raw, "caseName");
    const parsed = scenarioCaseSchema.safeParse(normalized);
    if (!parsed.success) {
      return {
        valid: false,
        caseId: rawCaseId,
        caseName: rawCaseName,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join(".") || "root",
          message: issue.message
        }))
      };
    }
    return {
      valid: true,
      caseId: parsed.data.case_id,
      caseName: parsed.data.case_name,
      issues: [],
      data: parsed.data
    };
  } catch (error) {
    return {
      valid: false,
      issues: [{ path: "yaml", message: error instanceof Error ? error.message : String(error) }]
    };
  }
}

function readStringField(raw: unknown, key: string): string | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeScenarioShape(raw: unknown): unknown {
  if (!isRecord(raw)) {
    return raw;
  }

  const scenario: Record<string, unknown> = { ...raw };
  scenario.case_id = stringValue(scenario.case_id) || stringValue(scenario.caseId);
  scenario.case_name = stringValue(scenario.case_name) || stringValue(scenario.caseName);
  scenario.case_type = stringValue(scenario.case_type) || stringValue(scenario.caseType) || undefined;

  const steps = flattenScenarioItems(scenario, (item, phase, index) => normalizeStepShape(item, phase, index));
  if (steps.length) {
    scenario.steps = steps;
  }

  return scenario;
}

async function normalizeScenarioForRun(rootDir: string, raw: unknown): Promise<unknown> {
  if (!isRecord(raw)) {
    return raw;
  }

  const scenario = normalizeScenarioShape(raw) as Record<string, unknown>;
  const counts = new Map<string, number>();
  const steps: unknown[] = [];

  for (const phase of scenarioPhases) {
    const items = phaseItems(raw, phase);
    for (const [index, item] of items.entries()) {
      steps.push(...await expandScenarioItem(rootDir, item, phase, index, counts, []));
    }
  }

  if (steps.length) {
    scenario.steps = steps;
  }

  return scenario;
}

function flattenScenarioItems(
  scenario: Record<string, unknown>,
  normalize: (item: unknown, phase: ScenarioPhase, index: number) => unknown
): unknown[] {
  return scenarioPhases.flatMap((phase) => phaseItems(scenario, phase).map((item, index) => normalize(item, phase, index)));
}

function phaseItems(scenario: Record<string, unknown>, phase: ScenarioPhase): unknown[] {
  const value = scenario[phase];
  return Array.isArray(value) ? value : [];
}

async function expandScenarioItem(
  rootDir: string,
  item: unknown,
  phase: ScenarioPhase,
  index: number,
  counts: Map<string, number>,
  stack: string[]
): Promise<unknown[]> {
  if (!isSharedReference(item)) {
    return [normalizeStepShape(item, phase, index)];
  }

  if (item.enabled === false) {
    return [];
  }
  if (stack.includes(item.use)) {
    throw new Error(`Shared step cycle: ${[...stack, item.use].join(" -> ")}`);
  }

  const template = await loadSharedStepTemplate(rootDir, item.use);
  const templateItems = sharedTemplateItems(template, phase);
  const key = `${phase}:${item.use}`;
  const occurrence = (counts.get(key) ?? 0) + 1;
  counts.set(key, occurrence);

  const prefix = stringValue(item.idPrefix) || `${phase}_${sanitizeId(item.use)}_${occurrence}`;
  const bindings = buildSharedBindings(item, template);
  const nested: unknown[] = [];

  for (const [nestedIndex, nestedItem] of templateItems.entries()) {
    const applied = applySharedBindings(nestedItem, bindings);
    for (const expanded of await expandScenarioItem(rootDir, applied, phase, nestedIndex, counts, [...stack, item.use])) {
      nested.push(prefixStepId(expanded, prefix));
    }
  }

  return nested;
}

async function loadSharedStepTemplate(rootDir: string, sharedId: string): Promise<Record<string, unknown>> {
  const relative = path.join("cases", "shared", ...sharedId.split("/")) + ".yaml";
  const filePath = path.resolve(rootDir, relative);
  const sharedDir = path.resolve(rootDir, "cases", "shared");
  if (!filePath.startsWith(sharedDir + path.sep)) {
    throw new Error(`Invalid shared step path: ${sharedId}`);
  }

  const raw = YAML.parse(await fs.readFile(filePath, "utf8")) as unknown;
  if (!isRecord(raw)) {
    throw new Error(`Invalid shared step content: ${sharedId}`);
  }

  const actualId = stringValue(raw.shared_id) || stringValue(raw.sharedId);
  if (actualId && actualId !== sharedId) {
    throw new Error(`Shared step id mismatch: expected ${sharedId}, got ${actualId}`);
  }
  return raw;
}

function sharedTemplateItems(template: Record<string, unknown>, phase: ScenarioPhase): unknown[] {
  const phases = isRecord(template.phases) ? template.phases : undefined;
  if (phase !== "steps" && phases) {
    const items = phases[phase as SharedStepPhase];
    if (Array.isArray(items)) {
      return items;
    }
  }

  const steps = template.steps;
  return Array.isArray(steps) ? steps : [];
}

function buildSharedBindings(reference: SharedReference, template: Record<string, unknown>): Record<string, unknown> {
  const definitions = isRecord(template.params) ? template.params : {};
  const provided = isRecord(reference.with) ? reference.with : {};
  const keys = new Set([...Object.keys(definitions), ...Object.keys(provided)]);
  const bindings: Record<string, unknown> = {};

  for (const key of keys) {
    const definition = isRecord(definitions[key]) ? definitions[key] : {};
    if (hasOwn(provided, key)) {
      bindings[key] = provided[key];
    } else if (hasOwn(definition, "default")) {
      bindings[key] = definition.default;
    } else if (definition.required === true) {
      throw new Error(`Missing shared step param: ${stringValue(template.shared_id) || stringValue(template.sharedId) || reference.use}.${key}`);
    }
  }

  return bindings;
}

function applySharedBindings(value: unknown, bindings: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (match, expression: string) => {
      const key = expression.trim();
      return hasOwn(bindings, key) ? String(bindings[key] ?? "") : match;
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => applySharedBindings(item, bindings));
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, applySharedBindings(item, bindings)]));
  }
  return value;
}

function normalizeStepShape(item: unknown, phase: ScenarioPhase, index: number): unknown {
  if (!isRecord(item) || isSharedReference(item)) {
    return item;
  }

  const step: Record<string, unknown> = { ...item };
  const params = isRecord(step.params) ? step.params : undefined;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (step[key] === undefined) {
        step[key] = value;
      }
    }
    delete step.params;
  }

  step.step_id = stringValue(step.step_id) || stringValue(step.stepId) || stringValue(step.id) || `${phase}_${index + 1}`;
  step.name = stringValue(step.name) || stringValue(step.title) || stringValue(step.step_id);
  step.phase = step.phase ?? phase;
  step.type = normalizeStepType(step.type);
  step.timeout_ms = step.timeout_ms ?? step.timeoutMs ?? step.timeout;
  step.expected_status = step.expected_status ?? step.expectedStatus;
  step.body_path = step.body_path ?? step.bodyPath;
  step.business_code_path = step.business_code_path ?? step.businessCodePath;
  step.save_as = step.save_as ?? step.saveAs;
  step.row_index = step.row_index ?? step.rowIndex;
  step.wait_for_network = step.wait_for_network ?? step.waitForNetwork;
  step.wait_for_api = step.wait_for_api ?? step.waitForApi;
  step.continue_on_failure = step.continue_on_failure ?? step.continueOnFailure;
  step.file = step.file ?? step.fileName;

  return step;
}

function normalizeStepType(type: unknown): unknown {
  if (type === "api_call") return "api_request";
  if (type === "api_assert_field") return "api_assert";
  if (type === "db_cleanup") return "db_clean";
  return type;
}

function prefixStepId(item: unknown, prefix: string): unknown {
  if (!isRecord(item) || !stringValue(item.step_id)) {
    return item;
  }
  return { ...item, step_id: `${prefix}_${stringValue(item.step_id)}` };
}

interface SharedReference {
  use: string;
  with?: Record<string, unknown>;
  enabled?: boolean;
  idPrefix?: string;
}

function isSharedReference(value: unknown): value is SharedReference {
  return isRecord(value) && typeof value.use === "string" && Boolean(value.use.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "shared";
}

export class ScenarioLoader {
  constructor(private readonly rootDir: string) {}

  async list(): Promise<ScenarioCase[]> {
    const scenarioDir = path.resolve(this.rootDir, "cases", "scenario");
    const files = await fs.readdir(scenarioDir);
    const scenarios = await Promise.all(
      files.filter((file) => file.endsWith(".yaml") || file.endsWith(".yml")).map((file) => this.load(path.resolve(scenarioDir, file)))
    );
    return scenarios.sort((a, b) => a.case_id.localeCompare(b.case_id));
  }

  async loadByCaseId(caseId: string): Promise<ScenarioCase> {
    const scenarios = await this.list();
    const scenario = scenarios.find((item) => item.case_id === caseId);
    if (!scenario) {
      throw new Error(`Case not found: ${caseId}`);
    }
    return scenario;
  }

  async load(filePath: string): Promise<ScenarioCase> {
    const raw = await loadYamlFile<unknown>(filePath);
    const normalized = await normalizeScenarioForRun(this.rootDir, raw);
    const parsed = scenarioCaseSchema.safeParse(normalized);
    if (!parsed.success) {
      throw new Error(`DSL validation failed: ${filePath}\n${parsed.error.message}`);
    }
    return parsed.data;
  }
}
