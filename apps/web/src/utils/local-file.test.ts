import assert from "node:assert/strict";
import test from "node:test";
import { createBase64FileCache, createObjectUrlPreview, mapWithConcurrency } from "./local-file";

test("caches base64 reads for the same local file", async () => {
  let reads = 0;
  const cache = createBase64FileCache({
    readAsDataUrl: async () => {
      reads += 1;
      return "data:text/plain;base64,Zm9v";
    }
  });
  const file = new File(["foo"], "foo.txt", { type: "text/plain", lastModified: 1 });

  assert.equal(await cache.read(file), "Zm9v");
  assert.equal(await cache.read(file), "Zm9v");
  assert.equal(reads, 1);
});

test("limits concurrent file reads", async () => {
  let active = 0;
  let maxActive = 0;

  const values = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    return value * 2;
  });

  assert.deepEqual(values, [2, 4, 6, 8]);
  assert.equal(maxActive, 2);
});

test("creates a revocable object url preview", () => {
  const revoked: string[] = [];
  const preview = createObjectUrlPreview(new File(["png"], "avatar.png", { type: "image/png" }), {
    createObjectURL: () => "blob:avatar",
    revokeObjectURL: (url) => revoked.push(url)
  });

  assert.equal(preview.url, "blob:avatar");
  preview.revoke();
  assert.deepEqual(revoked, ["blob:avatar"]);
});
