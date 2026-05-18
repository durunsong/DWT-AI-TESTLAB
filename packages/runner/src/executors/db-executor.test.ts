import assert from "node:assert/strict";
import test from "node:test";
import { DbExecutor } from "./db-executor";

test("blocks dangerous sql before any database connection is created", async () => {
  const executor = new DbExecutor({ env: "sit", enabled: true });

  await assert.rejects(() => executor.execute("drop table user"), /危险 SQL/);
  await assert.rejects(() => executor.execute("delete from user"), /无 WHERE/);
  await assert.rejects(() => executor.execute("update user set name = 'a'"), /无 WHERE/);
});

test("blocks db execution when disabled", async () => {
  const executor = new DbExecutor({ env: "sit", enabled: false });

  await assert.rejects(() => executor.execute("select 1"), /DB_ENABLED/);
});
