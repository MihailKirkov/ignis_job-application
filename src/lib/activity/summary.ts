import type { ActivityCategory, ActivityType } from '@/types/database';

// Pure helpers for the unified activity log. No DB / server-only imports here so
// these stay unit-testable and safe to import from anywhere.

// The category is always derivable from the type prefix (e.g. "application" from
// "application.status_changed").
export function categoryFromType(type: ActivityType): ActivityCategory {
  return type.split('.')[0] as ActivityCategory;
}

type Meta = Record<string, unknown>;

function s(meta: Meta, key: string): string | undefined {
  const v = meta[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function n(meta: Meta, key: string): number {
  const v = meta[key];
  return typeof v === 'number' ? v : 0;
}

// Build the denormalized, human-readable summary line stored alongside each
// event. Robust to missing meta — the log must never throw on render.
export function buildActivitySummary(type: ActivityType, meta: Meta = {}): string {
  const company = s(meta, 'company');
  const role = s(meta, 'role');
  const at = company ? ` at ${company}` : '';
  const sourceLabel = s(meta, 'label') ?? s(meta, 'type') ?? 'a';
  const name = s(meta, 'name');

  switch (type) {
    case 'application.created':
      return `Added ${role ?? 'a role'}${at}`;
    case 'application.status_changed': {
      const to = s(meta, 'to') ?? '?';
      const from = s(meta, 'from');
      const subject = company ?? 'Application';
      return from ? `${subject}: ${from} → ${to}` : `${subject} → ${to}`;
    }
    case 'application.deleted':
      return `Removed ${role ?? 'an application'}${at}`;
    case 'job.promoted':
      return `Promoted ${role ?? 'a job'}${at} to the pipeline`;
    case 'job.saved':
      return `Saved ${role ?? 'a job'}${at}`;
    case 'job.dismissed':
      return `Dismissed ${role ?? 'a job'}${at}`;
    case 'profile.updated': {
      const changed = Array.isArray(meta.changed)
        ? (meta.changed as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
      return changed.length ? `Updated profile (${changed.join(', ')})` : 'Updated profile';
    }
    case 'source.added':
      return `Added ${sourceLabel} source`;
    case 'source.removed':
      return `Removed ${sourceLabel} source`;
    case 'source.toggled':
      return `${meta.enabled ? 'Enabled' : 'Disabled'} ${sourceLabel} source`;
    case 'ingestion.completed': {
      const status = s(meta, 'status') ?? 'completed';
      return `Ingestion ${status} · ${n(meta, 'fetched')} fetched · ${n(meta, 'new')} new`;
    }
    case 'company.created':
      return `Added company ${name ?? '—'}`;
    case 'company.updated':
      return `Updated company ${name ?? '—'}`;
    case 'company.deleted':
      return `Removed company ${name ?? '—'}`;
    case 'contact.created':
      return `Added contact ${name ?? '—'}${at}`;
    case 'contact.updated':
      return `Updated contact ${name ?? '—'}${at}`;
    case 'contact.deleted':
      return `Removed contact ${name ?? '—'}${at}`;
    case 'outreach.logged': {
      const channel = s(meta, 'channel');
      return `Logged ${channel ?? 'outreach'}${at}`;
    }
    case 'outreach.status_changed': {
      const to = s(meta, 'to') ?? '?';
      const from = s(meta, 'from');
      const subject = company ?? name ?? 'Outreach';
      return from ? `${subject}: ${from} → ${to}` : `${subject} → ${to}`;
    }
    default:
      return type;
  }
}
