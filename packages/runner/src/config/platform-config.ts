import fs from "node:fs";
import path from "node:path";

export interface PlatformConfig {
  app: {
    brandName: string;
    productName: string;
  };
  server: {
    host: string;
    port: number;
    corsOrigins: string[];
  };
  web: {
    host: string;
    port: number;
    devApiProxyTarget: string;
    requestTimeoutMs: number;
    storageKey: string;
  };
  desktop: {
    appId: string;
    productName: string;
    maintainer: string;
    artifactName: string;
    apiPort: number;
    window: {
      title: string;
      width: number;
      height: number;
      minWidth: number;
      minHeight: number;
      menuBarVisible: boolean;
    };
  };
  workspace: {
    directories: string[];
  };
  artifacts: PlatformArtifactDirs;
  browser: {
    defaultViewport: {
      width: number;
      height: number;
    };
  };
  context: {
    defaultSources: string[];
    routeGroups: {
      enterpriseKeywords: string[];
      approvalKeywords: string[];
    };
  };
  uploads: {
    contextBodyLimitMb: number;
    materialFileMaxMb: number;
    caseAttachmentMaxMb: number;
    caseAttachmentBaseDir: string;
    materialSourceMaxChars: number;
    materialLinkMaxChars: number;
  };
}

export const platformConfigFileName = "platform.config.json";
export const platformArtifactKinds = ["logs", "screenshots", "reports", "traces"] as const;

export type PlatformArtifactKind = (typeof platformArtifactKinds)[number];

export interface PlatformArtifactDirs {
  logsDir: string;
  reportsDir: string;
  screenshotsDir: string;
  tracesDir: string;
}

export const defaultPlatformConfig: PlatformConfig = {
  app: {
    brandName: "DWT Testing",
    productName: "DWT Testing"
  },
  server: {
    host: "127.0.0.1",
    port: 4300,
    corsOrigins: ["http://127.0.0.1:4301", "http://localhost:4301"]
  },
  web: {
    host: "0.0.0.0",
    port: 4301,
    devApiProxyTarget: "http://localhost:4300",
    requestTimeoutMs: 20_000,
    storageKey: "dwt-testing-settings"
  },
  desktop: {
    appId: "io.github.dwt-testing.desktop",
    productName: "DWT Testing",
    maintainer: "DWT Testing contributors",
    artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
    apiPort: 0,
    window: {
      title: "DWT Testing",
      width: 1440,
      height: 920,
      minWidth: 1280,
      minHeight: 760,
      menuBarVisible: true
    }
  },
  workspace: {
    directories: ["cases", "logs", "reports", "screenshots", "traces", "uploads"]
  },
  artifacts: {
    logsDir: "logs",
    reportsDir: "reports",
    screenshotsDir: "screenshots",
    tracesDir: "traces"
  },
  browser: {
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  },
  context: {
    defaultSources: ["user", "admin"],
    routeGroups: {
      enterpriseKeywords: ["企业", "enterprise", "认证", "auth"],
      approvalKeywords: ["审批", "审核", "approve", "review"]
    }
  },
  uploads: {
    contextBodyLimitMb: 5,
    materialFileMaxMb: 8,
    caseAttachmentMaxMb: 20,
    caseAttachmentBaseDir: "uploads/cases",
    materialSourceMaxChars: 18_000,
    materialLinkMaxChars: 24_000
  }
};

export function loadPlatformConfig(rootDir = process.cwd()): PlatformConfig {
  const configPath = path.resolve(rootDir, platformConfigFileName);
  if (!fs.existsSync(configPath)) {
    return defaultPlatformConfig;
  }

  const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as unknown;
  if (!isRecord(raw)) {
    return defaultPlatformConfig;
  }

  return mergePlatformConfig(raw);
}

export function megabytesToBytes(value: number): number {
  return Math.max(1, Math.floor(value * 1024 * 1024));
}

export function artifactDirName(kind: PlatformArtifactKind): keyof PlatformArtifactDirs {
  return `${kind}Dir` as keyof PlatformArtifactDirs;
}

export function resolveArtifactBaseDir(rootDir: string, platformConfig: PlatformConfig, kind: PlatformArtifactKind): string {
  const configuredDir = platformConfig.artifacts[artifactDirName(kind)];
  const resolved = path.resolve(rootDir, configuredDir);
  assertInsideRoot(rootDir, resolved);
  return resolved;
}

export function assertInsideRoot(rootDir: string, targetPath: string): void {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(targetPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("配置目录必须位于项目根目录内");
  }
}

function mergePlatformConfig(input: Record<string, unknown>): PlatformConfig {
  const app = recordValue(input.app);
  const server = recordValue(input.server);
  const web = recordValue(input.web);
  const desktop = recordValue(input.desktop);
  const desktopWindow = recordValue(desktop.window);
  const workspace = recordValue(input.workspace);
  const artifacts = recordValue(input.artifacts);
  const browser = recordValue(input.browser);
  const defaultViewport = recordValue(browser.defaultViewport);
  const context = recordValue(input.context);
  const routeGroups = recordValue(context.routeGroups);
  const uploads = recordValue(input.uploads);

  return {
    app: {
      brandName: stringValue(app.brandName, defaultPlatformConfig.app.brandName),
      productName: stringValue(app.productName, defaultPlatformConfig.app.productName)
    },
    server: {
      host: stringValue(server.host, defaultPlatformConfig.server.host),
      port: numberValue(server.port, defaultPlatformConfig.server.port),
      corsOrigins: stringArrayValue(server.corsOrigins, defaultPlatformConfig.server.corsOrigins)
    },
    web: {
      host: stringValue(web.host, defaultPlatformConfig.web.host),
      port: numberValue(web.port, defaultPlatformConfig.web.port),
      devApiProxyTarget: stringValue(web.devApiProxyTarget, defaultPlatformConfig.web.devApiProxyTarget),
      requestTimeoutMs: numberValue(web.requestTimeoutMs, defaultPlatformConfig.web.requestTimeoutMs),
      storageKey: stringValue(web.storageKey, defaultPlatformConfig.web.storageKey)
    },
    desktop: {
      appId: stringValue(desktop.appId, defaultPlatformConfig.desktop.appId),
      productName: stringValue(desktop.productName, stringValue(app.productName, defaultPlatformConfig.desktop.productName)),
      maintainer: stringValue(desktop.maintainer, defaultPlatformConfig.desktop.maintainer),
      artifactName: stringValue(desktop.artifactName, defaultPlatformConfig.desktop.artifactName),
      apiPort: numberValue(desktop.apiPort, defaultPlatformConfig.desktop.apiPort),
      window: {
        title: stringValue(desktopWindow.title, stringValue(app.productName, defaultPlatformConfig.desktop.window.title)),
        width: numberValue(desktopWindow.width, defaultPlatformConfig.desktop.window.width),
        height: numberValue(desktopWindow.height, defaultPlatformConfig.desktop.window.height),
        minWidth: numberValue(desktopWindow.minWidth, defaultPlatformConfig.desktop.window.minWidth),
        minHeight: numberValue(desktopWindow.minHeight, defaultPlatformConfig.desktop.window.minHeight),
        menuBarVisible: booleanValue(desktopWindow.menuBarVisible, defaultPlatformConfig.desktop.window.menuBarVisible)
      }
    },
    workspace: {
      directories: stringArrayValue(workspace.directories, defaultPlatformConfig.workspace.directories)
    },
    artifacts: {
      logsDir: stringValue(artifacts.logsDir, defaultPlatformConfig.artifacts.logsDir),
      reportsDir: stringValue(artifacts.reportsDir, defaultPlatformConfig.artifacts.reportsDir),
      screenshotsDir: stringValue(artifacts.screenshotsDir, defaultPlatformConfig.artifacts.screenshotsDir),
      tracesDir: stringValue(artifacts.tracesDir, defaultPlatformConfig.artifacts.tracesDir)
    },
    browser: {
      defaultViewport: {
        width: numberValue(defaultViewport.width, defaultPlatformConfig.browser.defaultViewport.width),
        height: numberValue(defaultViewport.height, defaultPlatformConfig.browser.defaultViewport.height)
      }
    },
    context: {
      defaultSources: stringArrayValue(context.defaultSources, defaultPlatformConfig.context.defaultSources),
      routeGroups: {
        enterpriseKeywords: stringArrayValue(routeGroups.enterpriseKeywords, defaultPlatformConfig.context.routeGroups.enterpriseKeywords),
        approvalKeywords: stringArrayValue(routeGroups.approvalKeywords, defaultPlatformConfig.context.routeGroups.approvalKeywords)
      }
    },
    uploads: {
      contextBodyLimitMb: numberValue(uploads.contextBodyLimitMb, defaultPlatformConfig.uploads.contextBodyLimitMb),
      materialFileMaxMb: numberValue(uploads.materialFileMaxMb, defaultPlatformConfig.uploads.materialFileMaxMb),
      caseAttachmentMaxMb: numberValue(uploads.caseAttachmentMaxMb, defaultPlatformConfig.uploads.caseAttachmentMaxMb),
      caseAttachmentBaseDir: stringValue(uploads.caseAttachmentBaseDir, defaultPlatformConfig.uploads.caseAttachmentBaseDir),
      materialSourceMaxChars: numberValue(uploads.materialSourceMaxChars, defaultPlatformConfig.uploads.materialSourceMaxChars),
      materialLinkMaxChars: numberValue(uploads.materialLinkMaxChars, defaultPlatformConfig.uploads.materialLinkMaxChars)
    }
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringArrayValue(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const items = value
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim());
  return items.length ? [...new Set(items)] : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
