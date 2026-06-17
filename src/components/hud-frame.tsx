'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// =============================================================================
// HudFrame — the ONE coherent panel/card frame. Sharp corners, one or more
// CHAMFERED (45° cut). The corner brackets are integral segments of the same
// frame geometry (short strokes with deliberate gaps), drawn as a single
// absolutely-positioned SVG sized to the container via ResizeObserver, so the
// 1px cyan strokes stay crisp and the 45° cuts stay true at any size. The
// background is clipped to the same chamfer (CSS clip-path) so corners read as
// cut, not rounded. Nothing else in the app draws panel borders.
// =============================================================================

export type Corner = 'tl' | 'tr' | 'br' | 'bl';

const ALL: Corner[] = ['tl', 'tr', 'br', 'bl'];

// CSS clip-path polygon for the chamfered background.
function clipFor(chamfer: Corner[], c: number): string {
  const has = (k: Corner) => chamfer.includes(k);
  const pts: string[] = [];
  // tl
  pts.push(has('tl') ? `0 ${c}px` : `0 0`);
  if (has('tl')) pts.push(`${c}px 0`);
  // tr
  pts.push(has('tr') ? `calc(100% - ${c}px) 0` : `100% 0`);
  if (has('tr')) pts.push(`100% ${c}px`);
  // br
  pts.push(has('br') ? `100% calc(100% - ${c}px)` : `100% 100%`);
  if (has('br')) pts.push(`calc(100% - ${c}px) 100%`);
  // bl
  pts.push(has('bl') ? `${c}px 100%` : `0 100%`);
  if (has('bl')) pts.push(`0 calc(100% - ${c}px)`);
  return `polygon(${pts.join(', ')})`;
}

type Geo = { outline: string; brackets: string[]; accents: string[]; node: [number, number] | null };

function geometry(
  w: number,
  h: number,
  chamfer: Corner[],
  c: number,
  b: number,
  accentCorner: Corner | undefined,
  s = 0.5,
): Geo {
  const has = (k: Corner) => chamfer.includes(k);
  const L = s, T = s, R = w - s, B = h - s;

  // Full outline polygon points (faint continuous line).
  const op: [number, number][] = [];
  if (has('tl')) op.push([L, T + c], [L + c, T]);
  else op.push([L, T]);
  if (has('tr')) op.push([R - c, T], [R, T + c]);
  else op.push([R, T]);
  if (has('br')) op.push([R, B - c], [R - c, B]);
  else op.push([R, B]);
  if (has('bl')) op.push([L + c, B], [L, B - c]);
  else op.push([L, B]);
  const outline = op.map((p) => `${p[0]},${p[1]}`).join(' ');

  const brackets: string[] = [];
  const accents: string[] = [];

  // TL
  if (has('tl')) {
    brackets.push(`M ${L} ${T + c + b} L ${L} ${T + c} L ${L + c} ${T} L ${L + c + b} ${T}`);
    accents.push(`M ${L} ${T + c} L ${L + c} ${T}`);
  } else {
    brackets.push(`M ${L} ${T + b} L ${L} ${T} L ${L + b} ${T}`);
  }
  // TR
  if (has('tr')) {
    brackets.push(`M ${R - c - b} ${T} L ${R - c} ${T} L ${R} ${T + c} L ${R} ${T + c + b}`);
    accents.push(`M ${R - c} ${T} L ${R} ${T + c}`);
  } else {
    brackets.push(`M ${R - b} ${T} L ${R} ${T} L ${R} ${T + b}`);
  }
  // BR
  if (has('br')) {
    brackets.push(`M ${R} ${B - c - b} L ${R} ${B - c} L ${R - c} ${B} L ${R - c - b} ${B}`);
    accents.push(`M ${R} ${B - c} L ${R - c} ${B}`);
  } else {
    brackets.push(`M ${R} ${B - b} L ${R} ${B} L ${R - b} ${B}`);
  }
  // BL
  if (has('bl')) {
    brackets.push(`M ${L + c + b} ${B} L ${L + c} ${B} L ${L} ${B - c} L ${L} ${B - c - b}`);
    accents.push(`M ${L + c} ${B} L ${L} ${B - c}`);
  } else {
    brackets.push(`M ${L + b} ${B} L ${L} ${B} L ${L} ${B - b}`);
  }

  // Node sits on the accent (chamfered) corner's diagonal midpoint.
  let node: [number, number] | null = null;
  if (accentCorner && has(accentCorner)) {
    if (accentCorner === 'tl') node = [L + c / 2, T + c / 2];
    else if (accentCorner === 'tr') node = [R - c / 2, T + c / 2];
    else if (accentCorner === 'br') node = [R - c / 2, B - c / 2];
    else node = [L + c / 2, B - c / 2];
  }

  return { outline, brackets, accents, node };
}

export function HudFrame({
  chamfer = ['tl'],
  accentCorner,
  tone = 'system',
  accentTone,
  node = false,
  nodePulse = false,
  glow = true,
  chamferSize = 14,
  label,
  right,
  header = true,
  flush = false,
  bodyClassName,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  chamfer?: Corner[];
  accentCorner?: Corner;
  tone?: string;
  accentTone?: string;
  node?: boolean;
  nodePulse?: boolean;
  glow?: boolean;
  chamferSize?: number;
  label?: React.ReactNode;
  right?: React.ReactNode;
  header?: boolean;
  flush?: boolean;
  bodyClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // ResizeObserver fires its first callback asynchronously after observe, so
    // there's no synchronous setState in the effect body.
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const accent = accentCorner ?? (chamfer.length > 0 ? chamfer[0] : undefined);
  const c = chamferSize;
  const stroke = `var(--color-${tone})`;
  const accentStroke = `var(--color-${accentTone ?? tone})`;
  const geo =
    size.w > 0 && size.h > 0
      ? geometry(size.w, size.h, chamfer, c, 16, accent, 0.5)
      : null;

  const hasHeader = header && label !== undefined;

  return (
    <div
      ref={ref}
      className={cn('relative bg-surface', className)}
      style={{ clipPath: clipFor(chamfer, c) }}
      {...props}
    >
      {/* Frame strokes */}
      {geo ? (
        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          className="pointer-events-none absolute inset-0"
          aria-hidden
        >
          {/* faint continuous outline */}
          <polygon
            points={geo.outline}
            fill="none"
            stroke={stroke}
            strokeWidth={1}
            strokeOpacity={0.28}
          />
          {/* bright integral corner brackets */}
          <g
            fill="none"
            stroke={stroke}
            strokeWidth={1.25}
            style={glow ? { filter: `drop-shadow(0 0 2px ${stroke})` } : undefined}
          >
            {geo.brackets.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          {/* brighter accent segment on the chamfered corner(s) */}
          {geo.accents.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={accentStroke} strokeWidth={2} />
          ))}
          {/* optional connector node / LED on the accent corner, sitting ON the frame */}
          {node && geo.node ? (
            <circle
              cx={geo.node[0]}
              cy={geo.node[1]}
              r={3}
              fill={accentStroke}
              className={nodePulse ? 'hud-pulse' : undefined}
              style={{ filter: `drop-shadow(0 0 3px ${accentStroke})` }}
            />
          ) : null}
        </svg>
      ) : null}

      {/* Header */}
      {hasHeader ? (
        <>
          <div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-2.5">
            <div className="flex items-center gap-2">
              <span className="hud-hatch h-2.5 w-4 shrink-0" aria-hidden />
              <span className="hud-label">{label}</span>
            </div>
            {right ? <div className="flex items-center gap-2">{right}</div> : null}
          </div>
          <div
            className="mx-3.5 h-px"
            style={{
              background:
                'linear-gradient(to right, color-mix(in srgb, var(--color-system) 50%, transparent), transparent)',
            }}
            aria-hidden
          />
        </>
      ) : null}

      {/* Body */}
      <div className={cn(!flush && 'p-3.5', bodyClassName)}>{children}</div>
    </div>
  );
}

export { ALL as ALL_CORNERS };
