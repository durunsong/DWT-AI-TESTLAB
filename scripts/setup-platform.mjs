#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envExamplePath = path.resolve(rootDir, ".env.example");
const envPath = path.resolve(rootDir, ".env");
const platformConfigPath = path.resolve(rootDir, "platform.config.json");
const args = parseArgs(process.argv.slice(2));

const brand = args.brand ?? args.name;
const product = args.product;

const updates = {
  APP_BRAND_NAME: brand,
  VITE_APP_BRAND_NAME: brand,
  APP_PRODUCT_NAME: product,
  VITE_APP_PRODUCT_NAME: product,
  USER_LOGIN_URL: args.userLoginUrl,
  ADMIN_LOGIN_URL: args.adminLoginUrl,
  API_BASE_URL: args.apiBaseUrl,
  APP_API_BASE_URL: args.appApiBaseUrl,
  AI_BASE_URL: args.aiBaseUrl,
  AI_MODEL: args.aiModel
};
const platformUpdates = {
  brandName: brand,
  productName: product
};

if (args.help) {
  printHelp();
  process.exit(0);
}

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(envExamplePath, envPath);
}

const current = fs.readFileSync(envPath, "utf8");
const next = applyEnvUpdates(current, updates);
fs.writeFileSync(envPath, next, "utf8");
updatePlatformConfig(platformUpdates);

console.log(`已更新 ${path.relative(rootDir, envPath)}`);
console.log(`已同步 ${path.relative(rootDir, platformConfigPath)} 中的平台展示配置`);
console.log("下一步：补充账号、密码、AI Key、DB 只读账号等本地私有配置，然后执行 pnpm dwt validate。");

function parseArgs(values) {
  const output = {};
  for (const value of values) {
    if (value === "--help" || value === "-h") {
      output.help = true;
      continue;
    }
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      continue;
    }
    output[toCamelCase(match[1])] = match[2];
  }
  return output;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
}

function applyEnvUpdates(content, entries) {
  let output = content;
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) {
      continue;
    }
    const normalized = String(value).replace(/\r?\n/g, " ").trim();
    const line = `${key}=${normalized}`;
    const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, "m");
    if (pattern.test(output)) {
      output = output.replace(pattern, line);
    } else {
      output = `${output.replace(/\s*$/, "")}\n${line}\n`;
    }
  }
  return output.endsWith("\n") ? output : `${output}\n`;
}

function updatePlatformConfig(input) {
  if (!fs.existsSync(platformConfigPath)) {
    return;
  }

  const config = JSON.parse(fs.readFileSync(platformConfigPath, "utf8"));
  if (input.brandName) {
    config.app = { ...(config.app ?? {}), brandName: input.brandName };
  }
  if (input.productName) {
    config.app = { ...(config.app ?? {}), productName: input.productName };
    config.web = {
      ...(config.web ?? {}),
      storageKey: toStorageKey(input.productName)
    };
    config.desktop = {
      ...(config.desktop ?? {}),
      productName: input.productName,
      window: {
        ...(config.desktop?.window ?? {}),
        title: input.productName
      }
    };
  }

  fs.writeFileSync(platformConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function toStorageKey(value) {
  return `${String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "test-platform"}-settings`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function printHelp() {
  console.log([
    "Usage:",
    "  pnpm setup:platform --brand=\"QA Team\" --product=\"QA Test Platform\"",
    "",
    "Options:",
    "  --brand=NAME",
    "  --product=NAME",
    "  --user-login-url=URL",
    "  --admin-login-url=URL",
    "  --api-base-url=URL",
    "  --app-api-base-url=URL",
    "  --ai-base-url=URL",
    "  --ai-model=MODEL"
  ].join("\n"));
}
