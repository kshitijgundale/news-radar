import { z } from "zod";

export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const idSchema = z.uuid();

export const factStatusSchema = z.enum([
  "confirmed",
  "reported",
  "uncertain",
  "disputed",
]);

export const stateFactSchema = z
  .object({
    id: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    text: z.string().trim().min(1).max(500),
    status: factStatusSchema,
    evidenceIds: z.array(idSchema).min(1),
  })
  .strict();

export const situationStateSchema = z
  .object({
    summary: z.string().trim().min(1).max(500),
    facts: z.array(stateFactSchema).min(1).max(8),
  })
  .strict()
  .superRefine((state, context) => {
    const factIds = state.facts.map((fact) => fact.id);
    if (new Set(factIds).size !== factIds.length) {
      context.addIssue({ code: "custom", message: "State fact IDs must be unique", path: ["facts"] });
    }
  });

export const initialStateOutputSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    state: situationStateSchema,
  })
  .strict();

export const timelinePointInputSchema = z
  .object({
    headline: z.string().trim().min(1).max(160),
    detail: z.string().trim().min(1).max(1_000),
    occurredAt: isoDateTimeSchema.nullable(),
    evidenceIds: z.array(idSchema).min(1),
  })
  .strict();

export const updateDecisionSchema = z
  .object({
    meaningfulUpdate: z.boolean(),
    reason: z.string().trim().min(1).max(1_000),
    state: situationStateSchema,
    timelinePoints: z.array(timelinePointInputSchema).max(5),
  })
  .strict()
  .superRefine((decision, context) => {
    if (!decision.meaningfulUpdate && decision.timelinePoints.length > 0) {
      context.addIssue({
        code: "custom",
        message: "A no-change decision cannot contain timeline points",
        path: ["timelinePoints"],
      });
    }

    if (decision.meaningfulUpdate && decision.timelinePoints.length === 0) {
      context.addIssue({
        code: "custom",
        message: "A meaningful update must contain at least one timeline point",
        path: ["timelinePoints"],
      });
    }
  });

export const trackerStatusSchema = z.enum(["active", "paused", "error"]);
export const runStatusSchema = z.enum(["pending", "running", "succeeded", "failed"]);
export const runOutcomeSchema = z.enum(["baseline", "no_change", "changed", "failed"]);
export const fetchStatusSchema = z.enum(["fetched", "limited", "failed"]);
export const evidenceProcessingStatusSchema = z.enum([
  "pending",
  "processed",
  "skipped_unchanged",
  "rejected_irrelevant",
]);

export const pollIntervalMinutesSchema = z.number().int().min(15).max(10_080);

export const evidenceSchema = z
  .object({
    id: idSchema,
    canonicalUrl: z.url(),
    title: z.string().trim().min(1).max(500),
    publisher: z.string().trim().min(1).max(200).nullable(),
    publishedAt: isoDateTimeSchema.nullable(),
    retrievedAt: isoDateTimeSchema,
    contentHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    extractedContent: z.string().nullable(),
    fetchStatus: fetchStatusSchema,
  })
  .strict();

export const trackerSchema = z
  .object({
    id: idSchema,
    query: z.string().trim().min(1).max(1_000),
    title: z.string().trim().min(1).max(120).nullable(),
    summary: z.string().trim().min(1).max(500).nullable(),
    currentState: situationStateSchema.nullable(),
    status: trackerStatusSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    lastCheckedAt: isoDateTimeSchema.nullable(),
    lastChangedAt: isoDateTimeSchema.nullable(),
    nextCheckAt: isoDateTimeSchema.nullable(),
    pollIntervalMinutes: pollIntervalMinutesSchema,
  })
  .strict();

export const timelinePointSchema = timelinePointInputSchema.extend({
  id: idSchema,
  trackerId: idSchema,
  stateVersionId: idSchema,
  detectedAt: isoDateTimeSchema,
});

export const trackerRunSchema = z
  .object({
    id: idSchema,
    trackerId: idSchema,
    status: runStatusSchema,
    outcome: runOutcomeSchema.nullable(),
    startedAt: isoDateTimeSchema.nullable(),
    completedAt: isoDateTimeSchema.nullable(),
    error: z.string().nullable(),
  })
  .strict();

export const trackerListItemSchema = trackerSchema.pick({
  id: true,
  query: true,
  title: true,
  summary: true,
  status: true,
  lastCheckedAt: true,
  lastChangedAt: true,
}).extend({ latestRun: trackerRunSchema.nullable() });

export const trackerDetailSchema = trackerSchema.extend({
  timeline: z.array(timelinePointSchema),
  evidence: z.array(evidenceSchema),
  latestRun: trackerRunSchema.nullable(),
});

export const createTrackerRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(1_000),
    pollIntervalMinutes: pollIntervalMinutesSchema,
  })
  .strict();

export const updateTrackerScheduleRequestSchema = z
  .object({ pollIntervalMinutes: pollIntervalMinutesSchema })
  .strict();

export const createTrackerResponseSchema = z.object({
  tracker: trackerSchema,
  run: trackerRunSchema.nullable(),
}).strict();
export const trackerListResponseSchema = z.object({ trackers: z.array(trackerListItemSchema) }).strict();
export const trackerDetailResponseSchema = z.object({ tracker: trackerDetailSchema }).strict();

export type FactStatus = z.infer<typeof factStatusSchema>;
export type StateFact = z.infer<typeof stateFactSchema>;
export type SituationState = z.infer<typeof situationStateSchema>;
export type InitialStateOutput = z.infer<typeof initialStateOutputSchema>;
export type TimelinePointInput = z.infer<typeof timelinePointInputSchema>;
export type UpdateDecision = z.infer<typeof updateDecisionSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Tracker = z.infer<typeof trackerSchema>;
export type TrackerRun = z.infer<typeof trackerRunSchema>;
export type TrackerListItem = z.infer<typeof trackerListItemSchema>;
export type TrackerDetail = z.infer<typeof trackerDetailSchema>;
export type CreateTrackerRequest = z.infer<typeof createTrackerRequestSchema>;
export type CreateTrackerResponse = z.infer<typeof createTrackerResponseSchema>;
export type TrackerListResponse = z.infer<typeof trackerListResponseSchema>;
export type TrackerDetailResponse = z.infer<typeof trackerDetailResponseSchema>;
