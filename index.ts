import { Hono } from "hono";

import { app as serverApp } from "./apps/server/src/app.js";

// Vercel detects Hono from this root entry point. Mount the shared server app so
// local Node and Vercel use the same routes and dependencies.
const app = new Hono();
app.route("/", serverApp);

export default app;
