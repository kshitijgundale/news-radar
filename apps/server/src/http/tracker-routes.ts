import {
  createTrackerRequestSchema,
  updateTrackerScheduleRequestSchema,
  trackerDetailResponseSchema,
  trackerListResponseSchema,
} from "../contracts.js";
import { Hono, type Context } from "hono";

import type { TrackerExecutor } from "../execution/tracker-executor.js";
import type { EvidenceRepository } from "../repositories/evidence-repository.js";
import type { RunRepository } from "../repositories/run-repository.js";
import type { TimelineRepository } from "../repositories/timeline-repository.js";
import type { TrackerRepository } from "../repositories/tracker-repository.js";

export interface TrackerRouteDependencies {
  trackers: Pick<TrackerRepository, "create" | "delete" | "findById" | "list" | "setStatus" | "setPollInterval">;
  runs: Pick<RunRepository, "findLatest" | "findLatestForTrackers">;
  timeline: Pick<TimelineRepository, "listForTracker">;
  evidence: Pick<EvidenceRepository, "listForTracker">;
  executor: TrackerExecutor;
}

export function createTrackerRoutes(input: TrackerRouteDependencies) {
  const routes = new Hono();

  routes.post("/", async (context) => {
    const parsed = createTrackerRequestSchema.safeParse(await readJson(context.req.raw));
    if (!parsed.success) return context.json({ error: "Enter a situation to track", issues: parsed.error.issues }, 400);
    const tracker = await input.trackers.create(parsed.data.query, parsed.data.pollIntervalMinutes);
    // Await the baseline so serverless runtimes cannot freeze the invocation
    // before the initial tracker state has been persisted.
    const run = await input.executor.execute(tracker.id, `initial:${tracker.id}`);
    return context.json({ tracker, run }, 201);
  });

  routes.get("/", async (context) => {
    const trackers = await input.trackers.list();
    const runs = await input.runs.findLatestForTrackers(trackers.map((tracker) => tracker.id));
    return context.json(trackerListResponseSchema.parse({
      trackers: trackers.map((tracker) => ({
        id: tracker.id,
        query: tracker.query,
        title: tracker.title,
        summary: tracker.summary,
        status: tracker.status,
        lastCheckedAt: tracker.lastCheckedAt,
        lastChangedAt: tracker.lastChangedAt,
        latestRun: runs.get(tracker.id) ?? null,
      })),
    }));
  });

  routes.get("/:id", async (context) => {
    const tracker = await input.trackers.findById(context.req.param("id"));
    if (!tracker) return context.json({ error: "Tracker not found" }, 404);
    const [timeline, evidence, latestRun] = await Promise.all([
      input.timeline.listForTracker(tracker.id),
      input.evidence.listForTracker(tracker.id),
      input.runs.findLatest(tracker.id),
    ]);
    return context.json(trackerDetailResponseSchema.parse({
      tracker: { ...tracker, timeline, evidence, latestRun },
    }));
  });

  routes.delete("/:id", async (context) => {
    const deleted = await input.trackers.delete(context.req.param("id"));
    return deleted ? context.json({ deleted: true }) : context.json({ error: "Tracker not found" }, 404);
  });

  routes.post("/:id/pause", (context) => setStatus(context, input, "paused"));
  routes.post("/:id/reactivate", (context) => setStatus(context, input, "active"));
  routes.patch("/:id/schedule", async (context) => {
    const parsed = updateTrackerScheduleRequestSchema.safeParse(await readJson(context.req.raw));
    if (!parsed.success) return context.json({ error: "Choose a valid check frequency", issues: parsed.error.issues }, 400);
    const tracker = await input.trackers.setPollInterval(context.req.param("id"), parsed.data.pollIntervalMinutes);
    return tracker ? context.json({ tracker }) : context.json({ error: "Tracker not found" }, 404);
  });
  routes.post("/:id/check", async (context) => {
    const tracker = await input.trackers.findById(context.req.param("id"));
    if (!tracker) return context.json({ error: "Tracker not found" }, 404);
    if (tracker.status === "paused") return context.json({ error: "Reactivate this tracker before checking it" }, 409);
    const run = await input.executor.execute(tracker.id, `manual:${tracker.id}:${crypto.randomUUID()}`);
    return context.json({ run }, 202);
  });

  return routes;
}

async function setStatus(
  context: Context,
  input: TrackerRouteDependencies,
  status: "active" | "paused",
) {
  const tracker = await input.trackers.setStatus(context.req.param("id") ?? "", status);
  return tracker ? context.json({ tracker }) : context.json({ error: "Tracker not found" }, 404);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
