# News Radar

News Radar tracks a natural-language real-world situation as a concise current state and a timeline of meaningful changes. It is an Expo mobile client backed by a Hono/TypeScript service and PostgreSQL.

## Local setup

Requirements: Node.js 22+, npm, and PostgreSQL with `pgcrypto` available.

1. Copy `.env.example` to `.env` and set the database, OpenAI-compatible search/LLM credentials, and a random scheduler secret of at least 24 characters. Server npm commands automatically load this root file when it exists.
2. Create the database, then run `npm run db:migrate --workspace @radar/server`.
3. Start the API with `npm run dev:server`.
4. Set `EXPO_PUBLIC_API_URL` in the repository-root `.env` to a URL reachable by the simulator/device and run `npm run dev:mobile` in another terminal. The mobile workspace scripts explicitly load the root file before starting Expo.

Browser development origins on `localhost` or `127.0.0.1` are allowed automatically. For a deployed web client, set `CORS_ORIGINS` on the backend to its exact origin; separate multiple origins with commas.

Use `10.0.2.2` rather than `localhost` for an Android emulator. A physical device needs the computer's LAN address or a secure tunnel.

Run all validation with `npm run check`. The end-to-end fixture test drives one tracker through baseline creation, repeated evidence, an edited-in-place source with no material change, and a meaningful change.

### Local PostgreSQL and scheduler

With Homebrew PostgreSQL 16, start the database and apply migrations:

```sh
brew services start postgresql@16
createdb radar
npm run db:migrate --workspace @radar/server
```

Run one scheduler batch with `npm run scheduler:local`. For unattended local testing, the installed crontab invokes `scripts/run-local-scheduler.sh` every 15 minutes and appends output to `.local-scheduler.log`. The API must be running at `EXPO_PUBLIC_API_URL` for the cron call to succeed. Inspect the log with `tail -f .local-scheduler.log`.

## Deployment

### Demo deployment: Vercel + Neon

The lowest-maintenance demo setup is a Vercel Hobby project backed by a Neon
Free Postgres database. Both services scale to zero while idle. The repository
root exports the Hono API in `index.ts`, and `vercel.json` gives tracker runs the
Hobby plan's five-minute maximum duration.

1. Create a Neon project and copy its **pooled** connection string.
2. Import this repository into Vercel. Leave the Root Directory at the repository
   root and let Vercel detect Hono; do not set a build or output command.
3. Add every backend variable from `.env.example` to the Vercel Production
   environment. Set `DATABASE_URL` to the Neon pooled connection string and use
   a random `SCHEDULER_SECRET` of at least 24 characters.
4. Add the same values as GitHub's `production` environment secrets/variables,
   then run the **Migrate production database** workflow once.
5. Set `RADAR_SCHEDULER_URL` to the Vercel production URL and
   `RADAR_SCHEDULER_SECRET` to the same scheduler secret. Run **Run due Radar
   trackers** manually when demo data should be refreshed.
6. Set the Expo/EAS `EXPO_PUBLIC_API_URL` to the Vercel production URL and
   rebuild the mobile app.

The scheduler workflow is deliberately manual-only for the demo, so it does not
wake the API and database while they would otherwise be idle. Before presenting,
open `https://YOUR_PROJECT.vercel.app/health`, run the scheduler workflow if fresh
data is needed, and then launch the mobile app.

Tracker creation waits for its initial evidence and state to be persisted before
responding. Scheduler invocations process one due tracker at a time. These bounds
make execution reliable within the five-minute Hobby function limit; run the
manual workflow again to process another due tracker.

Vercel preview deployments inherit only variables explicitly enabled for the
Preview environment. Avoid pointing previews at the production database unless
that is intentional.

### Render alternative

`render.yaml` is a production blueprint for a PostgreSQL database and Docker-based API. The service runs migrations as a pre-deploy command. Equivalent platforms should run:

```sh
npm ci
npm run db:migrate --workspace @radar/server
npm run start --workspace @radar/server
```

Set every backend variable from `.env.example` on the server. Never expose `DATABASE_URL`, provider keys, or `SCHEDULER_SECRET` through `EXPO_PUBLIC_*`. Set only `EXPO_PUBLIC_API_URL` in the Expo/EAS environment, pointing to the HTTPS API origin.

The manual scheduler workflow requires repository secrets `RADAR_SCHEDULER_URL` and `RADAR_SCHEDULER_SECRET`. A manual, production-environment-protected migration workflow is also included; it uses `DATABASE_URL`, provider/secrets, plus `SEARCH_MODEL` and `LLM_MODEL` repository variables. The scheduler secret must match the backend value.

## Operations and inspection

Health check: `GET /health`.

Trigger a retry as a fresh, idempotent manual run:

```sh
curl --fail-with-body -X POST \
  -H "Authorization: Bearer $RADAR_SCHEDULER_SECRET" \
  "$RADAR_API_URL/internal/trackers/TRACKER_ID/check"
```

Inspect runs (including attempts, failures, and cached discovery), evidence processing/relevance, and immutable State History:

```sh
curl --fail-with-body \
  -H "Authorization: Bearer $RADAR_SCHEDULER_SECRET" \
  "$RADAR_API_URL/internal/inspect/trackers/TRACKER_ID"
```

The inspection API is deliberately internal and protected by the scheduler bearer secret; State History is not part of the primary mobile UI. Failed runs can be retried after correcting credentials/provider/database availability. The executor reuses discovery and retrieval cache within a run's bounded attempts. Do not edit `state_versions`; they are immutable by database trigger.

## Coverage limits and deferred features

Coverage is best-effort: search providers can miss developments, sources can block retrieval, snippets alone cannot confirm strong claims, and semantic judgments can still be imperfect. Review accepted and rejected updates during dogfooding.

The MVP intentionally defers push notifications, sharing/collaboration, advanced polling controls, exhaustive crawling, GDELT, embeddings/vector search, NLI models, event ontologies, multi-agent workflows, and a user-facing State History comparison UI.

## Dogfood review

Before calling the MVP production-ready, run at least five varied trackers (for example: policy/regulation, severe weather response, corporate transaction, court case, and transport disruption). For every run, use the inspection endpoint and record whether the update was accepted/rejected correctly, whether it duplicated known state, and any prompt/retrieval issue. This requires deployed infrastructure and live provider credentials and is intentionally not represented by deterministic fixtures.
