import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.resolve(__dirname, "../..");
const isolatedEnvDir = path.resolve(rootDir, ".vite-env-disabled");

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

  return {
    plugins: [react(), tailwindcss()],
    envDir: isolatedEnvDir,
    define: buildViteEnvDefine(env),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    },
    server: {
      host: "0.0.0.0",
      port: 4301,
      strictPort: true,
      proxy: {
        "/api": "http://localhost:4300",
        "/reports": "http://localhost:4300",
        "/screenshots": "http://localhost:4300",
        "/traces": "http://localhost:4300"
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
  return Object.fromEntries(
    Object.entries(env)
      .filter(([key]) => key.startsWith("VITE_"))
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
  );
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
