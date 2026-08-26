import { timingSafeEqual } from "node:crypto";

import { Hono, type Context } from "hono";

import type { TrackerExecutor } from "../execution/tracker-executor.js";
import { scheduledIdempotencyKey } from "../execution/tracker-executor.js";
import type { TrackerRepository } from "../repositories/tracker-repository.js";
import type { InspectionRepository } from "../repositories/inspection-repository.js";

export function createInternalRoutes(input: {
  executor: TrackerExecutor;
  trackers: Pick<TrackerRepository, "listDue">;
  inspection?: Pick<InspectionRepository, "inspectTracker">;
  schedulerSecret: string;
}) {
  const routes = new Hono();
  routes.use("*", async (context, next) => {
    const supplied = context.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!safeEqual(supplied, input.schedulerSecret)) return context.json({ error: "Unauthorized" }, 401);
    await next();
  });

  routes.post("/trackers/:id/check", async (context) => {
    const trackerId = context.req.param("id");
    const key = `manual:${trackerId}:${crypto.randomUUID()}`;
    const run = await input.executor.execute(trackerId, key);
    return context.json({ run }, 202);
  });

  routes.get("/inspect/trackers/:id", async (context) => {
    if (!input.inspection) return context.json({ error: "Inspection is unavailable" }, 404);
    return context.json(await input.inspection.inspectTracker(context.req.param("id")));
  });

  const runDue = async (context: Context) => {
    // One tracker per invocation keeps the demo scheduler comfortably bounded
    // by Vercel Hobby's function duration.
    const trackers = await input.trackers.listDue(1);
    const results = [];
    for (const tracker of trackers) {
      try {
        results.push(await input.executor.execute(
          tracker.id,
          scheduledIdempotencyKey(tracker, new Date(), Math.min(tracker.pollIntervalMinutes, 60)),
        ));
      } catch {
        // The failed run is already persisted; continue the bounded batch.
      }
    }
    return context.json({ selected: trackers.length, completed: results.length, runs: results });
  };
  routes.get("/scheduler/run-due", runDue);
  routes.post("/scheduler/run-due", runDue);
  return routes;
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
