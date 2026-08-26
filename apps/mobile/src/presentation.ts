import type { TrackerListItem, TrackerRun } from "@radar/contracts";

export interface TrackerPresentation { label: string; tone: "neutral" | "progress" | "changed" | "paused" | "error"; detail: string; }

export function presentTracker(tracker: Pick<TrackerListItem, "status" | "lastCheckedAt" | "lastChangedAt" | "latestRun">): TrackerPresentation {
  if (tracker.status === "paused") return { label: "Paused", tone: "paused", detail: "Scheduled checks are off" };
  const run = tracker.latestRun;
  if (!run || run.status === "pending" || (run.status === "running" && !tracker.lastCheckedAt)) return { label: "Establishing baseline", tone: "progress", detail: "Gathering the first Current State" };
  if (run.status === "running") return { label: "Checking now", tone: "progress", detail: "Looking for meaningful changes" };
  if (run.status === "failed") return { label: "Check failed", tone: "error", detail: "Open to retry" };
  if (run.outcome === "changed") return { label: "Updated", tone: "changed", detail: relativeTime(tracker.lastChangedAt) };
  if (run.outcome === "baseline") return { label: "Baseline ready", tone: "neutral", detail: relativeTime(tracker.lastCheckedAt) };
  return { label: "Checked · no change", tone: "neutral", detail: relativeTime(tracker.lastCheckedAt) };
}
export function runIsBusy(run: TrackerRun | null): boolean { return run?.status === "pending" || run?.status === "running"; }
export function relativeTime(value: string | null): string {
  if (!value) return "Not checked yet";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : new Date(value).toLocaleDateString();
}
