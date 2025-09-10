// src/utils/timeAgo.ts
export function timeAgo(iso: string | number | Date): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  let diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 1) diffSeconds = 1; // minimum 1 second

  const minutes = Math.floor(diffSeconds / 60);

  // If less than a minute, show in seconds
  if (minutes < 1) {
    return `${diffSeconds}s`;
  }

  // thresholds (in minutes)
  const HOUR = 60;
  const DAY = 1440;       // 24 * 60
  const WEEK = 10080;     // 7 * 1440
  const MONTH = 43800;    // ≈ 30.44 days
  const YEAR = 525960;    // ≈ 365.25 days

  if (minutes < HOUR) return `${minutes}m`;
  if (minutes < DAY) return `${Math.floor(minutes / HOUR)}h`;
  if (minutes < WEEK) return `${Math.floor(minutes / DAY)}d`;
  if (minutes < MONTH) return `${Math.floor(minutes / WEEK)}w`;
  if (minutes < YEAR) return `${Math.floor(minutes / MONTH)}mo`;
  return `${Math.floor(minutes / YEAR)}y`;
}
