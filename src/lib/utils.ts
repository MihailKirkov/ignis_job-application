import type { ApplicationStatus } from '@/types/database';
import { STATUS_COLOR, TERMINAL_STATUSES } from './constants';

// Minimal className combiner (avoids pulling in clsx for a few call sites).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// Today's date as YYYY-MM-DD in local time (used for "due today" comparisons and
// <input type="date"> defaults).
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// True when a YYYY-MM-DD date is today or in the past.
export function isDueOrOverdue(date: string | null, today = todayISO()): boolean {
  if (!date) return false;
  return date <= today;
}

export function isOverdue(date: string | null, today = todayISO()): boolean {
  if (!date) return false;
  return date < today;
}

export function isTerminal(status: ApplicationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function statusColorToken(status: ApplicationStatus): string {
  return STATUS_COLOR[status] ?? 'status-grey';
}

// Pretty short date, e.g. "11 Jun 2026". Returns "—" for null.
export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Compact date + 24h time, e.g. "14 Jun 09:12". Used by the telemetry log feed.
export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Compact salary range from numeric min/max, e.g. "€55k–70k".
export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '';
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  if (min != null && max != null) return `${sym}${k(min)}–${k(max)}`;
  if (min != null) return `${sym}${k(min)}+`;
  if (max != null) return `up to ${sym}${k(max)}`;
  return null;
}
