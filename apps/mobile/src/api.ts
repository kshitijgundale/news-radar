import {
  createTrackerResponseSchema, trackerDetailResponseSchema, trackerListResponseSchema,
  trackerRunSchema, trackerSchema, type TrackerDetail, type TrackerListItem,
} from "@radar/contracts";
import { z } from "zod";
import { publicConfig } from "./config";

const trackerMutationSchema = z.object({ tracker: trackerSchema }).strict();
const runResponseSchema = z.object({ run: trackerRunSchema }).strict();
const deleteResponseSchema = z.object({ deleted: z.literal(true) }).strict();

export async function listTrackers(): Promise<TrackerListItem[]> {
  return (await request("/api/trackers", trackerListResponseSchema)).trackers;
}
export async function getTracker(id: string): Promise<TrackerDetail> {
  return (await request(`/api/trackers/${id}`, trackerDetailResponseSchema)).tracker;
}
export async function deleteTracker(id: string): Promise<void> {
  await request(`/api/trackers/${id}`, deleteResponseSchema, { method: "DELETE" });
}
export async function createTracker(query: string, pollIntervalMinutes: number) {
  return request("/api/trackers", createTrackerResponseSchema, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, pollIntervalMinutes }) });
}
export async function pauseTracker(id: string) {
  return (await request(`/api/trackers/${id}/pause`, trackerMutationSchema, { method: "POST" })).tracker;
}
export async function reactivateTracker(id: string) {
  return (await request(`/api/trackers/${id}/reactivate`, trackerMutationSchema, { method: "POST" })).tracker;
}
export async function checkTracker(id: string) {
  return (await request(`/api/trackers/${id}/check`, runResponseSchema, { method: "POST" })).run;
}
export async function updateTrackerSchedule(id: string, pollIntervalMinutes: number) {
  return (await request(`/api/trackers/${id}/schedule`, trackerMutationSchema, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ pollIntervalMinutes }),
  })).tracker;
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`${publicConfig.apiUrl.replace(/\/$/, "")}${path}`, init); }
  catch { throw new Error("Radar could not reach the server. Check your connection and try again."); }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return schema.parse(body);
}
