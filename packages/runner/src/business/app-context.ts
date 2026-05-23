import fs from "node:fs/promises";
import path from "node:path";
import { maskSensitive } from "@ai-e2e/shared";
import { loadPlatformConfig } from "../config/platform-config";

export interface AppRouteNode {
  path: string;
  fullPath: string;
  name?: string;
  title?: string;
  component?: string;
  perm?: string;
  visible?: string;
  hidden?: boolean;
  menuType?: string;
  id?: string;
}

export interface AppAuthSourceSummary {
  source: string;
  authFile: string;
  routeSourceKey?: string;
  profile: Record<string, unknown>;
  routeCount: number;
  visibleRouteCount: number;
  routes: AppRouteNode[];
  enterpriseRoutes: AppRouteNode[];
  approvalRoutes: AppRouteNode[];
}

export interface AppContextSummary {
  user: AppAuthSourceSummary;
  admin: AppAuthSourceSummary;
  sources: AppAuthSourceSummary[];
}

export interface AppContextOptions {
  userAuthFile?: string;
  adminAuthFile?: string;
  enterpriseKeywords?: string[];
  approvalKeywords?: string[];
}

export interface AppContextParseOptions {
  enterpriseKeywords?: string[];
  approvalKeywords?: string[];
}

interface RawRouteNode {
  [key: string]: unknown;
}

interface RouteSourceCandidate {
  key: string;
  nodes: RawRouteNode[];
  score: number;
}

const routeArrayKeys = [
  "auths",
  "routes",
  "routers",
  "router",
  "menus",
  "menuList",
  "menuTree",
  "permissions",
  "permissionRoutes",
  "asyncRoutes",
  "constantRoutes",
  "children"
];
const routeLikeKeys = ["path", "route", "routePath", "url", "name", "title", "label", "component", "meta", "children"];
const routeContainerKeys = ["data", "result", "body", "payload"];

export async function loadAppContext(rootDir: string, options: AppContextOptions = {}): Promise<AppContextSummary> {
  const config = loadPlatformConfig(rootDir);
  const parseOptions = {
    enterpriseKeywords: options.enterpriseKeywords ?? config.context.routeGroups.enterpriseKeywords,
    approvalKeywords: options.approvalKeywords ?? config.context.routeGroups.approvalKeywords
  };
  const [user, admin] = await Promise.all([
    options.userAuthFile ? loadOne(rootDir, "user", options.userAuthFile, parseOptions) : Promise.resolve(createEmptyAppAuthSource("user")),
    options.adminAuthFile ? loadOne(rootDir, "admin", options.adminAuthFile, parseOptions) : Promise.resolve(createEmptyAppAuthSource("admin"))
  ]);

  return { user, admin, sources: [user, admin] };
}

export function createEmptyAppAuthSource(source: string): AppAuthSourceSummary {
  return {
    source,
    authFile: "",
    profile: {},
    routeCount: 0,
    visibleRouteCount: 0,
    routes: [],
    enterpriseRoutes: [],
    approvalRoutes: []
  };
}

export function parseAppAuthSourceContent(source: string, authFile: string, content: string, options: AppContextParseOptions = {}): AppAuthSourceSummary {
  return parseAppAuthSource(source, authFile, parseAuthSourceContent(content), options);
}

function parseAuthSourceContent(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch (jsonError) {
    const routes = parseRouteModuleContent(content);
    if (routes.length) {
      return { routes };
    }
    throw new Error(`路由来源文件不是有效 JSON，也未识别到可解析的路由数组或菜单树：${getErrorMessage(jsonError)}`);
  }
}

function parseRouteModuleContent(content: string): RawRouteNode[] {
  const source = stripJsComments(content);
  const candidates = collectRouteArrayLiterals(source);

  for (const candidate of candidates.sort((left, right) => right.score - left.score)) {
    const routes = parseRouteArrayLiteral(candidate.literal);
    if (routes.length) {
      return routes;
    }
  }

  const objectLiteral = findDefaultRouteObjectLiteral(source);
  if (objectLiteral) {
    const route = parseRouteObjectLiteral(objectLiteral);
    return scoreRouteNode(route) > 0 ? [route] : [];
  }

  return [];
}

function collectRouteArrayLiterals(source: string): Array<{ literal: string; score: number }> {
  const candidates: Array<{ literal: string; score: number }> = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "[") {
      continue;
    }
    const literal = readBalanced(source, index, "[", "]");
    if (!literal) {
      continue;
    }
    const prefix = source.slice(Math.max(0, index - 80), index).toLowerCase();
    const literalScore = scoreRouteArrayLiteral(prefix, literal);
    if (literalScore > 0) {
      candidates.push({ literal, score: literalScore });
    }
    index += literal.length - 1;
  }
  return candidates;
}

function scoreRouteArrayLiteral(prefix: string, literal: string): number {
  const keyScore = /\b(routes?|routers?|auths|menus?|menulist|menutree|children|permissions?|asyncroutes|constantroutes)\s*[:=]?\s*$/i.test(prefix)
    ? 50
    : 0;
  const routeLikeMatches = literal.match(/\b(path|routepath|url|component|children|meta|menuname|menutitle|title|label)\s*:/gi)?.length ?? 0;
  const objectCount = literal.match(/\{/g)?.length ?? 0;
  return routeLikeMatches > 0 && objectCount > 0 ? keyScore + routeLikeMatches * 2 + Math.min(objectCount, 50) : 0;
}

function parseRouteArrayLiteral(arrayLiteral: string): RawRouteNode[] {
  const body = arrayLiteral.trim().replace(/^\[/, "").replace(/\]$/, "");
  const nodes: RawRouteNode[] = [];
  for (const objectLiteral of readTopLevelObjectLiterals(body)) {
    const node = parseRouteObjectLiteral(objectLiteral);
    if (scoreRouteNode(node) > 0) {
      nodes.push(node);
    }
  }
  return nodes;
}

function parseRouteObjectLiteral(objectLiteral: string): RawRouteNode {
  const node: RawRouteNode = {};
  const stringMappings: Array<[keyof AppRouteNode | "routeName" | "menuName" | "menuTitle" | "label", string[]]> = [
    ["path", ["path", "route", "routePath", "url"]],
    ["name", ["name", "routeName"]],
    ["title", ["title", "label", "menuName", "menuTitle", "displayName"]],
    ["component", ["component", "componentPath", "view"]],
    ["perm", ["perm", "perms", "permission", "permissionCode", "code"]],
    ["visible", ["visible", "show"]],
    ["menuType", ["menuType", "type"]],
    ["id", ["id", "menuId"]]
  ];

  for (const [targetKey, sourceKeys] of stringMappings) {
    const value = pickRouteModuleString(objectLiteral, sourceKeys);
    if (value !== undefined) {
      node[targetKey] = value;
    }
  }

  const hidden = pickRouteModuleBoolean(objectLiteral, ["hidden", "isHidden"]);
  if (hidden !== undefined) {
    node.hidden = hidden;
  }

  const meta = findTopLevelPropertyValue(objectLiteral, ["meta"]);
  if (meta?.trim().startsWith("{")) {
    const title = pickRouteModuleString(meta, ["title", "name", "label"]);
    if (title !== undefined && !node.title) {
      node.title = title;
    }
  }

  const children = ["children", "routes", "menus", "menuList"]
    .flatMap((key) => {
      const value = findTopLevelPropertyValue(objectLiteral, [key]);
      return value?.trim().startsWith("[") ? parseRouteArrayLiteral(value) : [];
    });
  if (children.length) {
    node.children = children;
  }

  return node;
}

function findDefaultRouteObjectLiteral(source: string): string | undefined {
  const defaultIndex = source.search(/\bexport\s+default\b|\bmodule\.exports\s*=/);
  if (defaultIndex < 0) {
    return undefined;
  }
  const objectIndex = source.indexOf("{", defaultIndex);
  return objectIndex >= 0 ? readBalanced(source, objectIndex, "{", "}") : undefined;
}

function readTopLevelObjectLiterals(body: string): string[] {
  const result: string[] = [];
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== "{") {
      continue;
    }
    const literal = readBalanced(body, index, "{", "}");
    if (literal) {
      result.push(literal);
      index += literal.length - 1;
    }
  }
  return result;
}

function pickRouteModuleString(objectLiteral: string, keys: string[]): string | undefined {
  const value = findTopLevelPropertyValue(objectLiteral, keys)?.trim();
  if (!value) {
    return undefined;
  }
  return parseStaticString(value) ?? parseImportPath(value) ?? parsePrimitiveString(value);
}

function pickRouteModuleBoolean(objectLiteral: string, keys: string[]): boolean | undefined {
  const value = findTopLevelPropertyValue(objectLiteral, keys)?.trim();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function findTopLevelPropertyValue(objectLiteral: string, keys: string[]): string | undefined {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const body = objectLiteral.trim().replace(/^\{/, "").replace(/\}$/, "");
  let index = 0;

  while (index < body.length) {
    index = skipSeparators(body, index);
    const property = readPropertyName(body, index);
    if (!property) {
      index += 1;
      continue;
    }
    index = property.end;
    index = skipWhitespace(body, index);
    if (body[index] !== ":") {
      index = skipToNextTopLevelComma(body, index) + 1;
      continue;
    }
    index += 1;
    const valueStart = skipWhitespace(body, index);
    const valueEnd = readPropertyValueEnd(body, valueStart);
    if (wanted.has(property.name.toLowerCase())) {
      return body.slice(valueStart, valueEnd).trim();
    }
    index = valueEnd + 1;
  }

  return undefined;
}

function readPropertyName(source: string, start: number): { name: string; end: number } | undefined {
  const quote = source[start];
  if (quote === "\"" || quote === "'" || quote === "`") {
    const end = readQuotedEnd(source, start);
    if (end > start) {
      return { name: source.slice(start + 1, end), end: end + 1 };
    }
    return undefined;
  }
  const match = source.slice(start).match(/^[$A-Z_a-z][$\w]*/);
  return match?.[0] ? { name: match[0], end: start + match[0].length } : undefined;
}

function readPropertyValueEnd(source: string, start: number): number {
  let depth = 0;
  let quote: string | undefined;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === "\\") {
        index += 1;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{" || char === "[" || char === "(") {
      depth += 1;
      continue;
    }
    if (char === "}" || char === "]" || char === ")") {
      depth -= 1;
      continue;
    }
    if (char === "," && depth === 0) {
      return index;
    }
  }
  return source.length;
}

function skipToNextTopLevelComma(source: string, start: number): number {
  const end = readPropertyValueEnd(source, start);
  return Math.min(end, source.length - 1);
}

function skipSeparators(source: string, start: number): number {
  let index = skipWhitespace(source, start);
  while (source[index] === ",") {
    index = skipWhitespace(source, index + 1);
  }
  return index;
}

function skipWhitespace(source: string, start: number): number {
  let index = start;
  while (/\s/.test(source[index] ?? "")) {
    index += 1;
  }
  return index;
}

function parseStaticString(value: string): string | undefined {
  const quote = value[0];
  if (quote !== "\"" && quote !== "'" && quote !== "`") {
    return undefined;
  }
  const end = readQuotedEnd(value, 0);
  if (end <= 0) {
    return undefined;
  }
  const raw = value.slice(1, end);
  if (quote === "`" && raw.includes("${")) {
    return undefined;
  }
  return raw.replace(/\\([\\'"`nrt])/g, (_match, escaped: string) => {
    const map: Record<string, string> = { n: "\n", r: "\r", t: "\t" };
    return map[escaped] ?? escaped;
  });
}

function parseImportPath(value: string): string | undefined {
  return value.match(/\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/)?.[1];
}

function parsePrimitiveString(value: string): string | undefined {
  const primitive = value.match(/^(true|false|-?\d+(?:\.\d+)?)/)?.[1];
  return primitive;
}

function readQuotedEnd(source: string, start: number): number {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === quote) {
      return index;
    }
  }
  return -1;
}

function readBalanced(source: string, start: number, open: string, close: string): string | undefined {
  let depth = 0;
  let quote: string | undefined;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === "\\") {
        index += 1;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  return undefined;
}

function stripJsComments(source: string): string {
  let output = "";
  let quote: string | undefined;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      output += char;
      if (char === "\\") {
        index += 1;
        output += source[index] ?? "";
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      output += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      output += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        index += 1;
      }
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseAppAuthSource(source: string, authFile: string, raw: unknown, options: AppContextParseOptions = {}): AppAuthSourceSummary {
  const candidate = findRouteSource(raw);
  const data = isRecord(raw) && isRecord(raw.data) ? raw.data : isRecord(raw) ? raw : {};
  const routes = flattenRoutes(candidate?.nodes ?? []);
  const profile = buildSafeProfile(data);
  const enterpriseKeywords = options.enterpriseKeywords?.length
    ? options.enterpriseKeywords
    : loadPlatformConfig().context.routeGroups.enterpriseKeywords;
  const approvalKeywords = options.approvalKeywords?.length
    ? options.approvalKeywords
    : loadPlatformConfig().context.routeGroups.approvalKeywords;

  return {
    source,
    authFile,
    routeSourceKey: candidate?.key,
    profile,
    routeCount: routes.length,
    visibleRouteCount: routes.filter(isVisibleRoute).length,
    routes,
    enterpriseRoutes: findRoutesByKeyword(routes, enterpriseKeywords).slice(0, 30),
    approvalRoutes: findRoutesByKeyword(routes, approvalKeywords).slice(0, 30)
  };
}

export function findRoutesByKeyword(routes: AppRouteNode[], keywords: string[]): AppRouteNode[] {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  return routes.filter((route) => {
    const haystack = [route.path, route.fullPath, route.name, route.title, route.component, route.perm].filter(Boolean).join(" ").toLowerCase();
    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  });
}

async function loadOne(rootDir: string, source: string, authFile: string, options: AppContextParseOptions): Promise<AppAuthSourceSummary> {
  const absoluteFile = path.resolve(rootDir, authFile);
  return parseAppAuthSourceContent(source, authFile, await fs.readFile(absoluteFile, "utf8"), options);
}

function flattenRoutes(nodes: RawRouteNode[], parentPath = ""): AppRouteNode[] {
  const output: AppRouteNode[] = [];

  for (const node of nodes) {
    const children = getRouteChildren(node);
    const pathValue = pickString(node, ["path", "route", "routePath", "url"]) ?? "";
    const title = pickTitle(node);
    const fullPath = normalizeRoutePath(parentPath, pathValue);
    output.push({
      path: pathValue,
      fullPath,
      name: pickString(node, ["name", "routeName"]),
      title,
      component: pickString(node, ["component", "componentPath", "view"]),
      perm: pickString(node, ["perm", "perms", "permission", "permissionCode", "code"]),
      visible: pickString(node, ["visible", "show"]),
      hidden: pickBoolean(node, ["hidden", "isHidden"]),
      menuType: pickString(node, ["menuType", "type"]),
      id: pickString(node, ["id", "menuId"])
    });
    output.push(...flattenRoutes(children, fullPath));
  }

  return output;
}

function normalizeRoutePath(parentPath: string, currentPath: string): string {
  if (!parentPath && !currentPath) {
    return "";
  }
  if (!currentPath) {
    return parentPath;
  }
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(currentPath)) {
    return currentPath;
  }
  if (!parentPath && currentPath) {
    return ensureLeadingSlash(currentPath);
  }
  if (currentPath.startsWith("/")) {
    return currentPath;
  }
  return ensureLeadingSlash(`${parentPath}/${currentPath}`.replace(/\/+/g, "/"));
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function isVisibleRoute(route: AppRouteNode): boolean {
  if (route.hidden) {
    return false;
  }
  if (route.visible === undefined) {
    return true;
  }
  return ["0", "1", "true", "yes"].includes(route.visible.toLowerCase());
}

function findRouteSource(raw: unknown): RouteSourceCandidate | undefined {
  const candidates: RouteSourceCandidate[] = [];
  collectRouteCandidates(raw, "$", candidates, 0);
  return candidates.sort((left, right) => right.score - left.score || right.nodes.length - left.nodes.length)[0];
}

function collectRouteCandidates(value: unknown, key: string, candidates: RouteSourceCandidate[], depth: number): void {
  if (depth > 8) {
    return;
  }

  if (Array.isArray(value)) {
    const nodes = value.filter(isRecord) as RawRouteNode[];
    const score = scoreRouteArray(nodes, key);
    if (score > 0) {
      candidates.push({ key, nodes, score });
      return;
    }
    for (const item of value) {
      collectRouteCandidates(item, `${key}[]`, candidates, depth + 1);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const singleRouteScore = scoreRouteNode(value);
  if (singleRouteScore > 0 && ("path" in value || "routePath" in value || "children" in value)) {
    candidates.push({ key, nodes: [value], score: singleRouteScore + 10 });
  }

  for (const childKey of routeContainerKeys) {
    if (childKey in value) {
      collectRouteCandidates(value[childKey], `${key}.${childKey}`, candidates, depth + 1);
    }
  }

  for (const childKey of routeArrayKeys) {
    if (childKey in value) {
      collectRouteCandidates(value[childKey], `${key}.${childKey}`, candidates, depth + 1);
    }
  }

  for (const [childKey, childValue] of Object.entries(value)) {
    if (routeContainerKeys.includes(childKey) || routeArrayKeys.includes(childKey)) {
      continue;
    }
    if (Array.isArray(childValue) || isRecord(childValue)) {
      collectRouteCandidates(childValue, `${key}.${childKey}`, candidates, depth + 1);
    }
  }
}

function scoreRouteArray(nodes: RawRouteNode[], key: string): number {
  if (!nodes.length) {
    return 0;
  }

  const nodeScore = nodes.reduce((total, node) => total + scoreRouteNode(node), 0);
  if (nodeScore <= 0) {
    return 0;
  }

  const keyBonus = routeArrayKeys.some((routeKey) => key.endsWith(`.${routeKey}`)) ? 20 : 0;
  return nodeScore + keyBonus + Math.min(nodes.length, 50);
}

function scoreRouteNode(node: RawRouteNode): number {
  let score = 0;
  for (const key of routeLikeKeys) {
    if (key in node) {
      score += 2;
    }
  }
  if (isRecord(node.meta)) {
    score += 2;
  }
  if (getRouteChildren(node).length) {
    score += 4;
  }
  return score;
}

function getRouteChildren(node: RawRouteNode): RawRouteNode[] {
  for (const key of ["children", "routes", "menus", "menuList"]) {
    const value = node[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord) as RawRouteNode[];
    }
  }
  return [];
}

function pickTitle(node: RawRouteNode): string | undefined {
  const meta = isRecord(node.meta) ? node.meta : undefined;
  return (
    (meta ? pickString(meta, ["title", "name", "label"]) : undefined) ??
    pickString(node, ["title", "label", "menuName", "menuTitle", "displayName"])
  );
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }
  return undefined;
}

function pickBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildSafeProfile(data: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    "userId",
    "userType",
    "name",
    "mobileNo",
    "email",
    "userLevel",
    "userAuthStatus",
    "accountType",
    "enterNo",
    "enterStatus",
    "loginSource",
    "serviceProviderFlag",
    "isGoogleVerify"
  ];

  return maskSensitive(Object.fromEntries(keys.filter((key) => key in data).map((key) => [key, data[key]])));
}
