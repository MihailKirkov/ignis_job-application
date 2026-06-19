'use client';

import { useDraggable } from '@dnd-kit/core';
import type { ApplicationRow } from '@/types/database';
import { FIT_VERDICT_COLOR } from '@/lib/constants';
import { cn, statusColorToken } from '@/lib/utils';
import { RadialMeter } from './hud';
import { HudFrame } from './hud-frame';
import { EditApplicationButton } from './application-dialog';
import { DeleteApplicationButton } from './application-actions';
import type { FitInfo } from './app-card';

// The board lane card. Status is communicated by the column (no redundant label).
// The whole card is the drag node (no grip gutter) — so the role gets the FULL
// card width: 2-line clamp + real ellipsis (full text in the title tooltip).
// Company + location share one muted truncating line; salary only if present.
// The fit score lives in the footer row as a SMALL HUD mini-dial next to Edit, so
// it never occupies the title's row or reserves title width.

export function BoardCardView({
  row,
  fit,
  readOnly = false,
  dragging = false,
  overlay = false,
  className,
}: {
  row: ApplicationRow;
  fit?: FitInfo;
  readOnly?: boolean;
  dragging?: boolean;
  overlay?: boolean;
  className?: string;
}) {
  const statusToken = statusColorToken(row.status);
  const meta = [row.company, row.location].filter(Boolean).join(' · ');
  const showFooter = Boolean(fit) || (!readOnly && !overlay);

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

      <div className="p-2.5 pl-3">
        {/* Role — full card width, no reserved gutter or right-padding. */}
        <div className="flex items-start gap-1.5">
          <h3 className="line-clamp-2 flex-1 text-sm font-medium leading-snug text-fg" title={row.role}>
            {row.role}
          </h3>
          {row.link ? (
            <a
              href={row.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 shrink-0 text-faint transition-colors hover:text-system"
              aria-label="Open job link"
              title="Open job link"
              onPointerDown={(e) => e.stopPropagation()}
            >
              ↗
            </a>
          ) : null}
        </div>

        {meta ? (
          <div className="mt-1 truncate text-[11px] text-muted" title={meta}>
            {meta}
          </div>
        ) : null}

        {row.salary ? (
          <div className="mt-0.5 truncate font-mono text-[11px] text-faint">{row.salary}</div>
        ) : null}

        {showFooter ? (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            {/* small HUD mini-dial — keeps the dial aesthetic, off the title row */}
            {fit ? (
              <RadialMeter
                value={fit.score}
                size={30}
                thickness={4}
                colorToken={FIT_VERDICT_COLOR[fit.verdict ?? 'medium']}
                label={Math.round(fit.score)}
                className="shrink-0"
              />
            ) : (
              <span aria-hidden />
            )}

            {readOnly || overlay ? null : (
              // Interactive controls: stop pointerdown so the card doesn't drag.
              <div
                className="flex items-center gap-0.5"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <EditApplicationButton row={row} />
                <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <DeleteApplicationButton id={row.id} />
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </HudFrame>
  );
}

// Draggable wrapper: the ENTIRE card is the drag node (pointer/touch/keyboard
// listeners on the root). Interactive children (link, Edit/Delete) stop pointer
// propagation so they stay clickable. dnd-kit's attributes make the node
// focusable (role=button, tabIndex) so the keyboard sensor works.
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
    <div
      ref={setNodeRef}
      className="cursor-grab touch-none rounded-none outline-none active:cursor-grabbing focus-visible:ring-1 focus-visible:ring-system/60"
      {...listeners}
      {...attributes}
    >
      <BoardCardView row={row} fit={fit} dragging={isDragging} />
    </div>
  );
}
