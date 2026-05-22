import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.resolve(__dirname, "../..");
const isolatedEnvDir = path.resolve(rootDir, ".vite-env-disabled");
const platformConfig = readPlatformConfig();

const ENV_FILE_BY_MODE: Record<string, string> = {
  development: ".env",
  local: ".env.local",
  dev: ".env",
  sit: ".env.sit",
  prod: ".env.prod",
  production: ".env.prod"
};

export default defineConfig(({ mode }) => {
  const env = loadModeEnv(mode);
  const webPort = Number(env.VITE_WEB_PORT ?? process.env.WEB_PORT ?? platformConfig.web.port);
  const webHost = env.VITE_WEB_HOST ?? process.env.WEB_HOST ?? platformConfig.web.host;
  const apiProxyTarget = env.VITE_DEV_API_PROXY_TARGET ?? process.env.VITE_DEV_API_PROXY_TARGET ?? platformConfig.web.devApiProxyTarget;

  return {
    plugins: [react(), tailwindcss()],
    base: "./",
    envDir: isolatedEnvDir,
    define: buildViteEnvDefine(env),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    },
    optimizeDeps: {
      include: [
        "@ant-design/icons",
        "@monaco-editor/react",
        "antd",
        "axios",
        "dayjs",
        "react",
        "react-dom",
        "react-router-dom",
        "zustand"
      ]
    },
    server: {
      host: webHost,
      port: webPort,
      strictPort: true,
      proxy: {
        "/api": apiProxyTarget,
        "^/reports/.*\\.(html|json)$": apiProxyTarget,
        "/screenshots": apiProxyTarget,
        "/traces": apiProxyTarget
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)) {
              return "vendor-react";
            }

            if (/[\\/]node_modules[\\/]monaco-editor[\\/]/.test(id)) {
              return "vendor-monaco";
            }

            if (/[\\/]node_modules[\\/](axios|dayjs|zustand|clsx|tailwind-merge)[\\/]/.test(id)) {
              return "vendor-utils";
            }

            return undefined;
          }
        }
      }
    }
  };
});

function loadModeEnv(mode: string): Record<string, string> {
  const envFile = ENV_FILE_BY_MODE[mode] ?? ".env";
  const baseEnv = readEnvFile(".env");
  const modeEnv = envFile === ".env" ? {} : readEnvFile(envFile);
  return { ...baseEnv, ...modeEnv };
}

function readEnvFile(fileName: string): Record<string, string> {
  const envPath = path.resolve(rootDir, fileName);
  return fs.existsSync(envPath) ? parseEnvFile(fs.readFileSync(envPath, "utf8")) : {};
}

function buildViteEnvDefine(env: Record<string, string>): Record<string, string> {
  const mergedEnv = {
    VITE_APP_BRAND_NAME: platformConfig.app.brandName,
    VITE_APP_PRODUCT_NAME: platformConfig.app.productName,
    VITE_APP_CONTEXT_BODY_LIMIT_MB: String(platformConfig.uploads.contextBodyLimitMb),
    VITE_APP_UPLOAD_MAX_MB: String(platformConfig.uploads.materialFileMaxMb),
    VITE_APP_CASE_ATTACHMENT_MAX_MB: String(platformConfig.uploads.caseAttachmentMaxMb),
    VITE_APP_REQUEST_TIMEOUT_MS: String(platformConfig.web.requestTimeoutMs),
    VITE_APP_STORAGE_KEY: platformConfig.web.storageKey,
    ...env
  };
  return Object.fromEntries(
    Object.entries(mergedEnv)
      .filter(([key]) => key.startsWith("VITE_"))
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
  );
}

function readPlatformConfig(): {
  app: { brandName: string; productName: string };
  web: { host: string; port: number; devApiProxyTarget: string; requestTimeoutMs: number; storageKey: string };
  uploads: { contextBodyLimitMb: number; materialFileMaxMb: number; caseAttachmentMaxMb: number };
} {
  const fallback = {
    app: { brandName: "DWT Testing", productName: "DWT Testing" },
    web: {
      host: "0.0.0.0",
      port: 4301,
      devApiProxyTarget: "http://localhost:4300",
      requestTimeoutMs: 20_000,
      storageKey: "dwt-testing-settings"
    },
    uploads: { contextBodyLimitMb: 5, materialFileMaxMb: 8, caseAttachmentMaxMb: 20 }
  };
  const configPath = path.resolve(rootDir, "platform.config.json");
  if (!fs.existsSync(configPath)) {
    return fallback;
  }

  const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<typeof fallback>;
  return {
    app: {
      brandName: raw.app?.brandName || fallback.app.brandName,
      productName: raw.app?.productName || fallback.app.productName
    },
    web: {
      host: raw.web?.host || fallback.web.host,
      port: raw.web?.port || fallback.web.port,
      devApiProxyTarget: raw.web?.devApiProxyTarget || fallback.web.devApiProxyTarget,
      requestTimeoutMs: raw.web?.requestTimeoutMs || fallback.web.requestTimeoutMs,
      storageKey: raw.web?.storageKey || fallback.web.storageKey
    },
    uploads: {
      contextBodyLimitMb: raw.uploads?.contextBodyLimitMb || fallback.uploads.contextBodyLimitMb,
      materialFileMaxMb: raw.uploads?.materialFileMaxMb || fallback.uploads.materialFileMaxMb,
      caseAttachmentMaxMb: raw.uploads?.caseAttachmentMaxMb || fallback.uploads.caseAttachmentMaxMb
    }
  };
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    const key = match?.[1];
    const value = match?.[2];
    if (!key || value === undefined) {
      continue;
    }
    result[key] = parseEnvValue(value);
  }
  return result;
}

function parseEnvValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const raw = trimmed.slice(1, -1);
    return trimmed.startsWith("\"") ? raw.replace(/\\n/g, "\n").replace(/\\"/g, "\"") : raw;
  }
  const commentIndex = trimmed.search(/\s#/);
  return commentIndex >= 0 ? trimmed.slice(0, commentIndex).trim() : trimmed;
}
