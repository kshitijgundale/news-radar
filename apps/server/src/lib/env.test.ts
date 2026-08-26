import assert from "node:assert/strict";
import test from "node:test";

import { parseServerEnv } from "./env-schema.js";

const validEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/radar",
  SEARCH_API_KEY: "search-key",
  SEARCH_MODEL: "search-model",
  LLM_API_KEY: "llm-key",
  LLM_MODEL: "llm-model",
  SCHEDULER_SECRET: "a-secure-scheduler-secret",
};

test("parses server configuration with safe defaults", () => {
  const parsed = parseServerEnv(validEnv);

  assert.equal(parsed.PORT, 3000);
});

test("rejects missing server-only secrets", () => {
  assert.throws(() => parseServerEnv({}), /Invalid server environment/);
});
