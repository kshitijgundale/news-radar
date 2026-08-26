import assert from "node:assert/strict";
import test from "node:test";

import { Hono } from "hono";

import { createInternalRoutes } from "./internal-routes.js";

const secret = "a-secure-scheduler-secret";

test("rejects unauthenticated scheduler requests", async () => {
  const app = new Hono().route("/internal", createInternalRoutes({
    schedulerSecret: secret,
    trackers: { async listDue() { return []; } },
    executor: { async execute() { throw new Error("unexpected"); } },
  }));
  const response = await app.request("/internal/scheduler/run-due", { method: "POST" });
  assert.equal(response.status, 401);
});

test("rejects unauthenticated manual check requests", async () => {
  const app = new Hono().route("/internal", createInternalRoutes({
    schedulerSecret: secret,
    trackers: { async listDue() { return []; } },
    executor: { async execute() { throw new Error("unexpected"); } },
  }));
  const response = await app.request("/internal/trackers/tracker-id/check", { method: "POST" });
  assert.equal(response.status, 401);
});

test("starts an authenticated manual check", async () => {
  let idempotencyKey = "";
  const app = new Hono().route("/internal", createInternalRoutes({
    schedulerSecret: secret,
    trackers: { async listDue() { return []; } },
    executor: { async execute(_trackerId, key) { idempotencyKey = key; return { id: "run" } as never; } },
  }));
  const response = await app.request("/internal/trackers/tracker-id/check", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  assert.equal(response.status, 202);
  assert.match(idempotencyKey, /^manual:tracker-id:/);
});

test("executes an authenticated bounded due-tracker batch", async () => {
  let executions = 0;
  const app = new Hono().route("/internal", createInternalRoutes({
    schedulerSecret: secret,
    trackers: { async listDue(limit) { assert.equal(limit, 1); return [{ id: "00000000-0000-4000-8000-000000000001", pollIntervalMinutes: 15 }] as never; } },
    executor: { async execute() { executions += 1; return { id: "run" } as never; } },
  }));
  const response = await app.request("/internal/scheduler/run-due", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  assert.equal(response.status, 200);
  assert.equal(executions, 1);
});
