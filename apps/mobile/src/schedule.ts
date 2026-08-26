export const scheduleOptions = [
  { minutes: 15, label: "15 min" },
  { minutes: 60, label: "Hourly" },
  { minutes: 360, label: "6 hours" },
  { minutes: 1_440, label: "Daily" },
] as const;

export function scheduleLabel(minutes: number): string {
  return scheduleOptions.find((option) => option.minutes === minutes)?.label ??
    (minutes % 1_440 === 0 ? `Every ${minutes / 1_440} days` : `Every ${minutes} minutes`);
}
