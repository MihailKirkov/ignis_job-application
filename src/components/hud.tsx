import * as React from 'react';
import { cn } from '@/lib/utils';
import { HudFrame } from './hud-frame';

// =============================================================================
// Command Center HUD primitives. Framing is delegated to <HudFrame> (SVG). The
// rest here is server-safe presentation (no hooks). Glow stays on
// borders/dividers/gauges/active states — never body text.
// =============================================================================

export { HudFrame } from './hud-frame';
export type { Corner } from './hud-frame';

// --------------------------------------------------------------------------- SectionLabel
export function SectionLabel({
  className,
  children,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span className={cn('hud-label', className)} {...props}>
      {children}
    </span>
  );
}

// --------------------------------------------------------------------------- StatusLed
export function StatusLed({
  colorToken = 'system',
  alert = false,
  size = 8,
  className,
}: {
  colorToken?: string;
  alert?: boolean;
  size?: number;
  className?: string;
}) {
  const color = `var(--color-${colorToken})`;
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full', alert && 'hud-pulse', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: `0 0 6px -1px ${color}`,
      }}
      aria-hidden
    />
  );
}

// --------------------------------------------------------------------------- TickBar
// Segmented baseline scale for stat readouts. `lit` segments glow cyan.
export function TickBar({
  total = 12,
  lit = 0,
  className,
}: {
  total?: number;
  lit?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex h-2 items-stretch gap-[2px]', className)} aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={cn('hud-tick', i < lit && 'hud-tick-on')} />
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------- StatReadout
// Filled bracketed metric: mono index, big number, label, segmented baseline
// scale, and the status LED placed ON the frame (the chamfer-corner node).
export function StatReadout({
  label,
  value,
  colorToken = 'system',
  active = false,
  index,
  ledAlert = false,
  className,
}: {
  label: string;
  value: number | string;
  colorToken?: string;
  active?: boolean;
  index?: string;
  ledAlert?: boolean;
  className?: string;
}) {
  const color = `var(--color-${colorToken})`;
  const numeric = typeof value === 'number' ? value : null;
  const total = 12;
  const lit = numeric == null ? 0 : Math.max(0, Math.min(total, numeric));

  return (
    <HudFrame
      flush
      chamfer={['tl']}
      accentCorner="tl"
      accentTone={colorToken}
      node
      nodePulse={ledAlert}
      tone={active ? colorToken : 'system'}
      glow={active}
      className={className}
    >
      <div className="px-3 pb-2.5 pt-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="font-mono text-xl leading-none tabular-nums"
            style={{ color: active ? color : 'var(--color-fg)' }}
          >
            {value}
          </span>
          {index ? <span className="hud-label text-faint">{index}</span> : null}
        </div>
        <span className="hud-label mt-1.5 block truncate">{label}</span>
        {numeric != null ? <TickBar total={total} lit={lit} className="mt-2" /> : null}
      </div>
    </HudFrame>
  );
}

// --------------------------------------------------------------------------- RadialMeter (ticked dial)
// Segmented/ticked ring dial: dim tick ring, lit ticks + active arc for the
// value, mono % in the center. 270° sweep with a gap at the bottom. No deps.
export function RadialMeter({
  value,
  size = 96,
  thickness = 7,
  colorToken = 'system',
  label,
  caption,
  className,
}: {
  value: number;
  size?: number;
  thickness?: number;
  colorToken?: string;
  label?: React.ReactNode;
  caption?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const color = `var(--color-${colorToken})`;
  const dim = 'color-mix(in srgb, var(--color-system) 22%, transparent)';

  const N = size >= 64 ? 40 : 26;
  const start = 135; // degrees
  const sweep = 270;
  const rOuter = 47;
  const rInner = rOuter - (size >= 64 ? 7 : 5);
  const ticks = Array.from({ length: N + 1 }).map((_, i) => {
    const t = i / N;
    const a = ((start + sweep * t) * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return {
      x1: 50 + rInner * cos,
      y1: 50 + rInner * sin,
      x2: 50 + rOuter * cos,
      y2: 50 + rOuter * sin,
      on: t <= pct / 100 + 0.0001,
    };
  });

  // Active arc just inside the tick ring.
  const rArc = rInner - 2;
  const cArc = 2 * Math.PI * rArc;
  const arcLen = (sweep / 360) * cArc;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? caption ?? 'meter'}: ${Math.round(pct)} of 100`}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        {ticks.map((tk, i) => (
          <line
            key={i}
            x1={tk.x1}
            y1={tk.y1}
            x2={tk.x2}
            y2={tk.y2}
            stroke={tk.on ? color : dim}
            strokeWidth={1.4}
            strokeLinecap="round"
            style={tk.on ? { filter: `drop-shadow(0 0 1.5px ${color})` } : undefined}
          />
        ))}
        <g transform="rotate(135 50 50)">
          <circle
            cx="50"
            cy="50"
            r={rArc}
            fill="none"
            stroke={color}
            strokeWidth={thickness * 0.4}
            strokeDasharray={`${arcLen * (pct / 100)} ${cArc}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 2px ${color})` }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono font-semibold leading-none tabular-nums"
          style={{ color, fontSize: size >= 64 ? '1.05rem' : '0.66rem' }}
        >
          {label ?? Math.round(pct)}
        </span>
        {caption ? <span className="hud-label mt-1 block">{caption}</span> : null}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- LogFeed
export type LogEntry = {
  time: string;
  text: React.ReactNode;
  colorToken?: string;
};

export function LogFeed({
  entries,
  empty = 'No telemetry yet.',
  className,
}: {
  entries: LogEntry[];
  empty?: string;
  className?: string;
}) {
  if (entries.length === 0) {
    return <p className="font-mono text-xs text-faint">{empty}</p>;
  }
  return (
    <ul className={cn('flex flex-col gap-1.5 font-mono text-xs', className)}>
      {entries.map((e, i) => (
        <li key={i} className="flex items-start gap-2.5 leading-relaxed">
          <span className="shrink-0 tabular-nums text-faint">{e.time}</span>
          <StatusLed colorToken={e.colorToken ?? 'system'} size={6} className="mt-1.5" />
          <span className="min-w-0 text-muted">{e.text}</span>
        </li>
      ))}
    </ul>
  );
}
