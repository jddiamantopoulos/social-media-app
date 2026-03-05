/**
 * Lightweight relative time formatter.
 *
 * Converts a date or timestamp into a short, human-readable
 * "time ago" string (e.g., 45s, 12m, 3h, 5d, 2w, 6mo, 1y).
 *
 * Designed for feed, comment, and notification timestamps where
 * compact display is preferred over full locale formatting.
 */
export function timeAgo(iso: string | number | Date): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  let diffSeconds = Math.floor((now - then) / 1000);

  // Minimum 1 second
  if (diffSeconds < 1) diffSeconds = 1;

  const minutes = Math.floor(diffSeconds / 60);

  // If less than a minute, show in seconds
  if (minutes < 1) {
    return `${diffSeconds}s`;
  }

  // Thresholds (in minutes)
  const HOUR = 60;
  const DAY = 1440;       // 24 * 60
  const WEEK = 10080;     // 7 * 1440
  const MONTH = 43800;    // about 30.44 days
  const YEAR = 525960;    // about 365.25 days

  if (minutes < HOUR) return `${minutes}m`;
  if (minutes < DAY) return `${Math.floor(minutes / HOUR)}h`;
  if (minutes < WEEK) return `${Math.floor(minutes / DAY)}d`;
  if (minutes < MONTH) return `${Math.floor(minutes / WEEK)}w`;
  if (minutes < YEAR) return `${Math.floor(minutes / MONTH)}mo`;
  return `${Math.floor(minutes / YEAR)}y`;
}
