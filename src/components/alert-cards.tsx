import type { ApplicationRow, ContactRow, OutreachRow } from '@/types/database';
import { OUTREACH_STATUS_COLOR } from '@/lib/constants';
import { cn, formatDate } from '@/lib/utils';
import { SectionLabel, StatusLed } from './hud';
import { HudFrame } from './hud-frame';
import { AppCard, type FitInfo } from './app-card';
import { ClearFollowUpButton } from './contact-actions';
import { ClearBumpButton } from './outreach-actions';

// A unified Priority-Alerts item. The command bridge merges three due-or-overdue
// sources into one queue; each renders with an entity-aware card.
export type AlertItem =
  | { kind: 'application'; key: string; row: ApplicationRow; fit?: FitInfo }
  | { kind: 'contact'; key: string; row: ContactRow; companyName?: string }
  | { kind: 'outreach'; key: string; row: OutreachRow; companyName?: string; contactName?: string };

type Severity = 'overdue' | 'due';

// Shared frame for the non-application cards (contact follow-up / outreach bump),
// mirroring AppCard's compact look: left-edge severity accent, LED + labels, date,
// and a ✓ clear action.
function AlertShell({
  severity,
  ledToken,
  tagToken,
  tag,
  title,
  link,
  meta,
  note,
  date,
  readOnly,
  clear,
}: {
  severity: Severity;
  ledToken: string;
  tagToken: string;
  tag: string;
  title: string;
  link?: string | null;
  meta?: string;
  note?: string | null;
  date: string | null;
  readOnly: boolean;
  clear: React.ReactNode;
}) {
  const edgeToken = severity === 'overdue' ? 'status-rejected' : 'accent';
  return (
    <HudFrame
      flush
      chamfer={['tl']}
      chamferSize={10}
      tone={severity === 'overdue' ? 'status-rejected' : 'system'}
      accentTone={edgeToken}
      glow={severity === 'overdue'}
      className="bg-surface-2/60 transition-colors hover:bg-surface-2"
    >
      <span
        className="absolute inset-y-0 left-0 z-10 w-[3px]"
        style={{ backgroundColor: `var(--color-${edgeToken})` }}
        aria-hidden
      />
      <div className="p-2.5 pl-3.5">
        <div className="flex items-center gap-1.5">
          <StatusLed colorToken={ledToken} alert={severity === 'overdue'} size={7} />
          <SectionLabel style={{ color: `var(--color-${tagToken})` }}>{tag}</SectionLabel>
          <SectionLabel
            style={{ color: `var(--color-${severity === 'overdue' ? 'status-rejected' : 'accent'})` }}
          >
            · {severity === 'overdue' ? 'OVERDUE' : 'DUE TODAY'}
          </SectionLabel>
        </div>

        <div className="mt-1 flex items-center gap-1.5">
          <h3 className="truncate text-sm font-medium text-fg">{title}</h3>
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-faint transition-colors hover:text-system"
              aria-label="Open link"
              title="Open link"
            >
              ↗
            </a>
          ) : null}
        </div>
        <div className="truncate text-[11px] text-muted">{meta || '—'}</div>
        {note ? <div className="mt-1.5 truncate text-xs text-fg">{note}</div> : null}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span
            className={cn(
              'font-mono text-[11px]',
              severity === 'overdue' ? 'text-status-rejected' : 'text-faint',
            )}
          >
            {date ? `${severity === 'overdue' ? '⚠ ' : 'next '}${formatDate(date)}` : '—'}
          </span>
          {readOnly ? null : <div className="flex items-center">{clear}</div>}
        </div>
      </div>
    </HudFrame>
  );
}

function ContactAlertCard({
  row,
  companyName,
  severity,
  readOnly,
}: {
  row: ContactRow;
  companyName?: string;
  severity: Severity;
  readOnly: boolean;
}) {
  const meta = [companyName, row.role].filter(Boolean).join(' · ');
  return (
    <AlertShell
      severity={severity}
      ledToken="system"
      tagToken="system"
      tag="FOLLOW-UP"
      title={row.name}
      link={row.linkedin_url}
      meta={meta}
      note={row.notes}
      date={row.next_follow_up_at}
      readOnly={readOnly}
      clear={<ClearFollowUpButton id={row.id} />}
    />
  );
}

function OutreachAlertCard({
  row,
  companyName,
  contactName,
  severity,
  readOnly,
}: {
  row: OutreachRow;
  companyName?: string;
  contactName?: string;
  severity: Severity;
  readOnly: boolean;
}) {
  const meta = [companyName, contactName, row.channel].filter(Boolean).join(' · ');
  const title = row.subject ?? `${row.channel ?? 'Outreach'} follow-up`;
  return (
    <AlertShell
      severity={severity}
      ledToken={OUTREACH_STATUS_COLOR[row.status]}
      tagToken={OUTREACH_STATUS_COLOR[row.status]}
      tag={`BUMP · ${row.status}`}
      title={title}
      meta={meta}
      note={row.notes}
      date={row.next_bump_at}
      readOnly={readOnly}
      clear={<ClearBumpButton id={row.id} />}
    />
  );
}

// The single entry point the command bridge renders for each queue item.
export function AlertCard({
  item,
  severity,
  readOnly = false,
}: {
  item: AlertItem;
  severity: Severity;
  readOnly?: boolean;
}) {
  switch (item.kind) {
    case 'application':
      return <AppCard row={item.row} fit={item.fit} severity={severity} readOnly={readOnly} />;
    case 'contact':
      return (
        <ContactAlertCard
          row={item.row}
          companyName={item.companyName}
          severity={severity}
          readOnly={readOnly}
        />
      );
    case 'outreach':
      return (
        <OutreachAlertCard
          row={item.row}
          companyName={item.companyName}
          contactName={item.contactName}
          severity={severity}
          readOnly={readOnly}
        />
      );
  }
}
