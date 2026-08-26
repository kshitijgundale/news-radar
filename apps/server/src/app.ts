import { readFile } from "node:fs/promises";

import { Hono } from "hono";
import { cors } from "hono/cors";

import { createExecutionRuntime } from "./execution/runtime.js";
import { createInternalRoutes } from "./http/internal-routes.js";
import { createTrackerRoutes } from "./http/tracker-routes.js";
import { env } from "./lib/env.js";

export const app = new Hono();

// Vercel's Hono dispatcher owns the bare root before static rewrites run. Serve
// the Expo entry document without changing the URL so Expo Router resolves `/`
// instead of treating `/index.html` as an application route.
app.get("/", async (context) => context.html(
  await readFile(new URL("../../../public/index.html", import.meta.url), "utf8"),
));

const configuredOrigins = new Set(
  env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
);
app.use("/api/*", cors({
  origin: (origin) => {
    if (configuredOrigins.has(origin)) return origin;
    if (env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return origin;
    }
    return "";
  },
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
}));

app.get("/health", (context) =>
  context.json({ service: "radar-server", status: "ok" as const }),
);

const runtime = createExecutionRuntime();
app.route("/api/trackers", createTrackerRoutes(runtime));
app.route("/internal", createInternalRoutes({
  executor: runtime.executor,
  trackers: runtime.trackers,
  inspection: runtime.inspection,
  schedulerSecret: env.SCHEDULER_SECRET,
}));
