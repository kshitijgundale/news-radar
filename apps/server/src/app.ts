import { Hono } from "hono";
import { cors } from "hono/cors";

import { createExecutionRuntime } from "./execution/runtime.js";
import { createInternalRoutes } from "./http/internal-routes.js";
import { createTrackerRoutes } from "./http/tracker-routes.js";
import { env } from "./lib/env.js";

export const app = new Hono();

// Vercel's Hono dispatcher owns the bare root before static rewrites run.
// Redirect it to the committed Expo entry document; all other UI routes are
// handled by the SPA rewrites in vercel.json.
app.get("/", (context) => context.redirect("/index.html"));

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
