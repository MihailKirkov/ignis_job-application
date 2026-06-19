'use client';

import { useDraggable } from '@dnd-kit/core';
import type { ApplicationRow } from '@/types/database';
import { FIT_VERDICT_COLOR } from '@/lib/constants';
import { cn, statusColorToken } from '@/lib/utils';
import { HudFrame } from './hud-frame';
import { EditApplicationButton } from './application-dialog';
import { DeleteApplicationButton } from './application-actions';
import type { FitInfo } from './app-card';

// The board lane card. Status is communicated by the column (no redundant label).
// Role gets the FULL card width with a 2-line clamp + real ellipsis (full text in
// the title tooltip); company + location share one muted line. The fit indicator
// is pulled OUT of the title's flow into a compact colored score pill, absolutely
// pinned to the top-right corner, so it never steals the role's width. Salary /
// next-action lines are omitted entirely when null (no placeholder "—"). A grip
// handle makes it draggable; Delete hides behind hover/focus to cut noise.

// Compact colored score pill, pinned to the card's top-right corner. Color tracks
// the fit verdict. The role's first line clears it via right-padding.
function FitPill({ fit }: { fit: FitInfo }) {
  const token = FIT_VERDICT_COLOR[fit.verdict ?? 'medium'];
  const color = `var(--color-${token})`;
  return (
    <span
      className="absolute right-1.5 top-1.5 z-20 rounded-sm border px-1 py-px font-mono text-[11px] font-semibold leading-none tabular-nums"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 14%, var(--color-surface-2))`,
      }}
      title={`Fit ${Math.round(fit.score)}${fit.verdict ? ` · ${fit.verdict}` : ''}`}
      aria-label={`Fit score ${Math.round(fit.score)} of 100`}
    >
      {Math.round(fit.score)}
    </span>
  );
}

function GripHandle({
  listeners,
  attributes,
}: {
  listeners?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
}) {
  return (
    <span
      role={listeners ? 'button' : undefined}
      tabIndex={listeners ? 0 : undefined}
      aria-label={listeners ? 'Drag to change status' : undefined}
      className={cn(
        'mt-0.5 shrink-0 select-none font-mono text-sm leading-none text-faint',
        listeners
          ? 'cursor-grab touch-none transition-colors hover:text-system active:cursor-grabbing'
          : 'opacity-40',
      )}
      {...listeners}
      {...attributes}
    >
      ⠿
    </span>
  );
}

export function BoardCardView({
  row,
  fit,
  readOnly = false,
  dragging = false,
  overlay = false,
  listeners,
  attributes,
  className,
}: {
  row: ApplicationRow;
  fit?: FitInfo;
  readOnly?: boolean;
  dragging?: boolean;
  overlay?: boolean;
  listeners?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  className?: string;
}) {
  const statusToken = statusColorToken(row.status);
  const meta = [row.company, row.location].filter(Boolean).join(' · ');

  return (
    <HudFrame
      flush
      chamfer={['tl']}
      chamferSize={10}
      tone="system"
      accentTone={statusToken}
      glow={overlay}
      className={cn(
        'group bg-surface-2/60',
        overlay
          ? 'cursor-grabbing shadow-2xl ring-1 ring-system/40'
          : 'transition-colors hover:bg-surface-2',
        dragging && 'opacity-40',
        className,
      )}
    >
      {/* left-edge status accent */}
      <span
        className="absolute inset-y-0 left-0 z-10 w-[3px]"
        style={{ backgroundColor: `var(--color-${statusToken})` }}
        aria-hidden
      />

      {/* fit score pill, pinned top-right and out of the title's flow */}
      {fit ? <FitPill fit={fit} /> : null}

      <div className="p-2 pl-2.5">
        <div className="flex items-start gap-2">
          {readOnly ? null : <GripHandle listeners={listeners} attributes={attributes} />}

          <div className="min-w-0 flex-1">
            {/* Role gets full width; pr clears the corner fit pill on the first line. */}
            <h3
              className={cn(
                'line-clamp-2 text-sm font-medium leading-snug text-fg',
                fit && 'pr-9',
              )}
              title={row.role}
            >
              {row.role}
            </h3>

            {meta || row.link ? (
              <div className="mt-1 flex items-center gap-1.5">
                {meta ? (
                  <span className="truncate text-[11px] text-muted" title={meta}>
                    {meta}
                  </span>
                ) : null}
                {row.link ? (
                  <a
                    href={row.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-faint transition-colors hover:text-system"
                    aria-label="Open job link"
                    title="Open job link"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    ↗
                  </a>
                ) : null}
              </div>
            ) : null}

            {row.salary ? (
              <div className="mt-0.5 truncate font-mono text-[11px] text-faint">{row.salary}</div>
            ) : null}
          </div>
        </div>

        {readOnly || overlay ? null : (
          <div className="mt-1.5 flex items-center justify-end gap-0.5">
            <EditApplicationButton row={row} />
            <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <DeleteApplicationButton id={row.id} />
            </span>
          </div>
        )}
      </div>
    </HudFrame>
  );
}

// Draggable wrapper: the whole card is the drag node, the grip carries the
// pointer/keyboard listeners (so links and the Edit/Delete buttons stay clickable).
export function DraggableBoardCard({
  row,
  fit,
}: {
  row: ApplicationRow;
  fit?: FitInfo;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: row.id,
    data: { status: row.status },
  });

  return (
    <div ref={setNodeRef}>
      <BoardCardView
        row={row}
        fit={fit}
        dragging={isDragging}
        listeners={listeners as unknown as Record<string, unknown>}
        attributes={attributes as unknown as Record<string, unknown>}
      />
    </div>
  );
}
