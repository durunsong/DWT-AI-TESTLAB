import assert from "node:assert/strict";
import test from "node:test";
import { fetchMaterialLinks } from "./ai-material.service";

test("rejects IPv6 loopback document links before fetch", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("fetch should not be called");
  }) as typeof fetch;

  try {
    await assert.rejects(() => fetchMaterialLinks(["http://[::1]/doc"]), /内网|本机/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not follow redirects while importing document links", async () => {
  const originalFetch = globalThis.fetch;
  let redirect: RequestRedirect | undefined;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    redirect = init?.redirect;
    return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
  }) as typeof fetch;

  try {
    await fetchMaterialLinks(["https://example.com/doc"]);
    assert.equal(redirect, "manual");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects document links whose declared response size exceeds the configured limit", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("too large", {
    status: 200,
    headers: {
      "content-length": "20"
    }
  })) as typeof fetch;

  try {
    await assert.rejects(
      () => fetchMaterialLinks(["https://example.com/doc"], {
        materialFileMaxMb: 1,
        materialSourceMaxChars: 5,
        materialLinkMaxChars: 5
      }),
      /文档链接内容超过/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
