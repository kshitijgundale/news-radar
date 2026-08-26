import assert from "node:assert/strict";
import test from "node:test";

import type { QueryResult, QueryResultRow } from "pg";

import { withTransaction } from "./transaction.js";
import type { PoolLike } from "./types.js";

function fakeDatabase(log: string[]): PoolLike {
  const client = {
    async query<Row extends QueryResultRow = QueryResultRow>(text: string): Promise<QueryResult<Row>> {
      log.push(text);
      return { rows: [], command: "", rowCount: 0, oid: 0, fields: [] };
    },
    release() {
      log.push("RELEASE");
    },
  };

  return {
    query: client.query,
    async connect() {
      return client as never;
    },
  };
}

test("commits successful transactional work", async () => {
  const log: string[] = [];
  const result = await withTransaction(fakeDatabase(log), async (client) => {
    await client.query("WORK");
    return 42;
  });

  assert.equal(result, 42);
  assert.deepEqual(log, ["BEGIN", "WORK", "COMMIT", "RELEASE"]);
});

test("rolls back failed transactional work", async () => {
  const log: string[] = [];

  await assert.rejects(
    withTransaction(fakeDatabase(log), async () => {
      throw new Error("boom");
    }),
    /boom/,
  );
  assert.deepEqual(log, ["BEGIN", "ROLLBACK", "RELEASE"]);
});
