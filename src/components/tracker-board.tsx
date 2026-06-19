'use client';

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { ApplicationRow, ApplicationStatus } from '@/types/database';
import { setStatus } from '@/lib/actions/applications';
import { APPLICATION_STATUSES } from '@/lib/constants';
import { cn, statusColorToken } from '@/lib/utils';
import { BoardCardView, DraggableBoardCard } from './board-card';
import type { FitMap } from './app-card';
import { LaneAddButton } from './application-dialog';
import { HudFrame, SectionLabel, StatusLed } from './hud';

// Active pipeline lanes (left → right). Rejected/Closed are compact archive
// drop zones below — so the whole lifecycle is drag-reachable, not just the
// active stages.
const ACTIVE_LANES: ApplicationStatus[] = ['To apply', 'Applied', 'Screening', 'Interview', 'Offer'];
const ARCHIVE_LANES: ApplicationStatus[] = ['Rejected', 'Closed'];

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCED_MOTION_QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false, // server snapshot — assume motion is allowed
  );
}

function LaneCount({ count, token }: { count: number; token: string }) {
  return (
    <span
      className="font-mono text-sm font-semibold tabular-nums"
      style={{ color: `var(--color-${token})`, textShadow: `0 0 10px var(--color-${token})` }}
    >
      {count}
    </span>
  );
}

function Lane({
  status,
  rows,
  fitMap,
  readOnly,
  compact = false,
  dragActive = false,
}: {
  status: ApplicationStatus;
  rows: ApplicationRow[];
  fitMap: FitMap;
  readOnly: boolean;
  compact?: boolean;
  // True while any card is being dragged — empty lanes expand back to full
  // drop targets so the whole lifecycle stays drag-reachable.
  dragActive?: boolean;
}) {
  const token = statusColorToken(status);
  // The scrollable card list is the drop target — including its empty space, so
  // an empty lane is still reachable.
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: readOnly });

  // Collapse an idle, empty active lane to a thin header-only rail so populated
  // lanes get the horizontal room. It re-expands the moment a drag starts.
  const collapsed = !compact && rows.length === 0 && !dragActive;

  return (
    <HudFrame
      label={status}
      accentTone={token}
      node
      right={
        <div className="flex items-center gap-2">
          {readOnly ? null : <LaneAddButton status={status} />}
          <LaneCount count={rows.length} token={token} />
        </div>
      }
      bodyClassName="p-1.5"
      className={cn(
        'shrink-0 transition-[width] duration-200',
        compact ? 'w-full' : collapsed ? 'w-[132px]' : 'w-[300px]',
      )}
    >
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 overflow-y-auto overflow-x-hidden rounded-none p-1 transition-colors',
          compact
            ? 'max-h-[34vh] min-h-[64px]'
            : collapsed
              ? 'min-h-[20px]'
              : 'max-h-[58vh] min-h-[88px]',
          isOver && 'bg-[color-mix(in_srgb,var(--color-system)_10%,transparent)] ring-1 ring-system/40',
        )}
      >
        {rows.map((row) =>
          readOnly ? (
            <BoardCardView key={row.id} row={row} fit={row.job_id ? fitMap[row.job_id] : undefined} readOnly />
          ) : (
            <DraggableBoardCard key={row.id} row={row} fit={row.job_id ? fitMap[row.job_id] : undefined} />
          ),
        )}
        {rows.length === 0 && !collapsed ? (
          <p className="py-3 text-center font-mono text-[10px] text-faint">
            {readOnly ? '— empty' : isOver ? '▾ drop here' : '— empty'}
          </p>
        ) : null}
      </div>
    </HudFrame>
  );
}

export function TrackerBoard({
  applications,
  fitMap,
  readOnly = false,
}: {
  applications: ApplicationRow[];
  fitMap: FitMap;
  readOnly?: boolean;
}) {
  // Optimistic overrides keyed by application id: the lane a card was *dropped*
  // into, kept authoritative until the server confirms the move. Deriving the
  // rendered list from `applications` + these overrides (rather than a full
  // local copy) means a stale revalidation can't bounce a card back to its old
  // lane mid-flight — the override stays until fresh data actually shows the
  // move, at which point we drop it and the (identical) server value takes over.
  const [pending, setPending] = useState<Record<string, ApplicationStatus>>({});
  const [seenApplications, setSeenApplications] = useState(applications);
  if (seenApplications !== applications) {
    setSeenApplications(applications);
    setPending((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const row of applications) {
        if (next[row.id] !== undefined && row.status === next[row.id]) {
          delete next[row.id];
          changed = true;
        }
      }
      // Drop overrides for rows that no longer exist (e.g. deleted elsewhere).
      const live = new Set(applications.map((r) => r.id));
      for (const id of ids) {
        if (!live.has(id) && next[id] !== undefined) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }

  const items =
    Object.keys(pending).length === 0
      ? applications
      : applications.map((r) =>
          pending[r.id] !== undefined ? { ...r, status: pending[r.id] } : r,
        );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startMove] = useTransition();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const from = active.data.current?.status as ApplicationStatus | undefined;
    const to = over.id as ApplicationStatus;
    // Cross-column moves only; ignore same-lane drops and unknown targets.
    if (!from || from === to || !APPLICATION_STATUSES.includes(to)) return;

    // Move the card immediately — the override is authoritative until resolved.
    setPending((p) => ({ ...p, [id]: to }));
    // setStatus emits the status_changed activity event + revalidates. On success
    // we leave the override; reconciliation clears it once fresh data shows the
    // move (no flicker). On error, drop the override (reverts) and toast.
    startMove(async () => {
      try {
        await setStatus(id, to);
      } catch {
        setPending((p) => {
          const next = { ...p };
          delete next[id];
          return next;
        });
        setToast(`Couldn't move to ${to}. Reverted.`);
      }
    });
  }

  const byStatus = (s: ApplicationStatus) => items.filter((r) => r.status === s);
  const activeRow = activeId ? items.find((r) => r.id === activeId) ?? null : null;

  const board = (
    <div className="space-y-4">
      {/* Active lanes — a real kanban: a horizontal flex row of ~300px lanes in an
          overflow-x:auto scroller. Lanes are NOT compressed to fit the viewport
          (that's what made cards unreadable); accept horizontal scroll instead. */}
      <div className="flex items-start gap-3 overflow-x-auto scroll-smooth pb-2">
        {ACTIVE_LANES.map((status) => (
          <Lane
            key={status}
            status={status}
            rows={byStatus(status)}
            fitMap={fitMap}
            readOnly={readOnly}
            dragActive={activeId !== null}
          />
        ))}
      </div>

      {/* Archive — Rejected / Closed as compact, always-visible drop zones. */}
      <div className="space-y-2">
        <SectionLabel className="flex items-center gap-2 text-faint">
          <StatusLed colorToken="status-grey" size={7} />
          ARCHIVE · REJECTED / CLOSED
        </SectionLabel>
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
          {ARCHIVE_LANES.map((status) => (
            <Lane key={status} status={status} rows={byStatus(status)} fitMap={fitMap} readOnly={readOnly} compact />
          ))}
        </div>
      </div>
    </div>
  );

  // DndContext always wraps (so the lane droppables have a provider even in the
  // read-only demo); drag is inert when read-only (no sensors, no overlay).
  return (
    <DndContext
      sensors={readOnly ? undefined : sensors}
      collisionDetection={closestCorners}
      onDragStart={readOnly ? undefined : onDragStart}
      onDragEnd={readOnly ? undefined : onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {board}
      {readOnly ? null : (
        <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
          {activeRow ? (
            <BoardCardView
              row={activeRow}
              fit={activeRow.job_id ? fitMap[activeRow.job_id] : undefined}
              overlay
            />
          ) : null}
        </DragOverlay>
      )}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 max-w-xs border border-status-rejected/50 bg-surface-2 px-3 py-2 font-mono text-[11px] text-status-rejected shadow-lg"
          style={{ boxShadow: '0 0 14px color-mix(in srgb, var(--color-status-rejected) 25%, transparent)' }}
        >
          {toast}
        </div>
      ) : null}
    </DndContext>
  );
}
