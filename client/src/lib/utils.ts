import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTTL(ttl: string): string {
  return !ttl || ttl === '0s' || ttl === '0' ? 'None' : ttl;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Number.parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(duration: string): string {
  if (!duration || duration === '0s') return 'Just now';

  // Handle different formats like "4m57s", "1h30m", etc.
  const matches = duration.match(/(\d+)([hms])/g);
  if (!matches) return duration;

  const parts = matches.map((match) => {
    const [, value, unit] = match.match(/(\d+)([hms])/)!;
    const num = Number.parseInt(value);
    switch (unit) {
      case 'h':
        return `${num}h`;
      case 'm':
        return `${num}m`;
      case 's':
        return `${num}s`;
      default:
        return match;
    }
  });

  return parts.join(' ');
}

export function formatTimestamp(timestamp: string): string {
  if (!timestamp) return 'N/A';

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;

    return date.toLocaleDateString();
  } catch (error) {
    return timestamp;
  }
}

const DURATION_MS: Record<string, number> = {
  ns: 1e-6,
  µs: 1e-3,
  us: 1e-3,
  ms: 1,
  s: 1000,
};

/** Go duration string ("117.614791ms", "850µs") -> "117.6ms" / "850µs" / "1.20s". */
export function formatRTT(rtt: string): string {
  if (!rtt) return 'N/A';
  const match = /^([\d.]+)(ns|µs|us|ms|s)$/.exec(rtt);
  if (!match) return rtt;
  const ms = Number.parseFloat(match[1]) * DURATION_MS[match[2]];
  if (ms < 1) return `${Math.round(ms * 1000)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * A Go time.Duration as NATS sends it (nanoseconds) in plain units:
 * 604800000000000 → "7d", 90000000000 → "1m 30s". 0 or absent → "No limit".
 */
export function formatNanosDuration(nanos: number | undefined | null): string {
  if (!nanos) return 'No limit';
  let seconds = Math.round(nanos / 1e9);
  if (seconds === 0) {
    const ms = Math.round(nanos / 1e6);
    return ms === 0 ? '<1ms' : `${ms}ms`;
  }
  const units: Array<[string, number]> = [
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
    ['s', 1],
  ];
  const parts: string[] = [];
  for (const [label, size] of units) {
    if (seconds >= size) {
      parts.push(`${Math.floor(seconds / size)}${label}`);
      seconds %= size;
    }
  }
  return parts.join(' ');
}

/** "12s ago", "3m ago", "2h ago", "4d ago" — or "never" for an absent time. */
export function formatAgo(
  iso: string | undefined | null,
  now = Date.now()
): string {
  if (!iso) return 'never';
  const t = Date.parse(iso);
  if (Number.isNaN(t) || t <= 0) return 'never';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
