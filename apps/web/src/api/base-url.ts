const API_BASE_QUERY_KEY = "apiBaseUrl";

export function getApiBaseUrl(): string {
  const queryBase = readQueryValue(API_BASE_QUERY_KEY);
  const envBase = import.meta.env.VITE_API_BASE_URL;
  return stripTrailingSlash(queryBase || envBase || "/api");
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (base.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return `${base}${normalizedPath.slice("/api".length)}`;
  }

  return `${base}${normalizedPath}`;
}

export function artifactUrl(path: string | undefined): string | undefined {
  if (!path || /^(https?:|data:|blob:)/i.test(path)) {
    return path;
  }

  const apiOrigin = getApiOrigin();
  if (!apiOrigin) {
    return path;
  }

  return `${apiOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

function getApiOrigin(): string | undefined {
  const base = getApiBaseUrl();
  if (!/^https?:\/\//i.test(base)) {
    return undefined;
  }

  return new URL(base).origin;
}

function readQueryValue(key: string): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return new URLSearchParams(window.location.search).get(key) ?? undefined;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
