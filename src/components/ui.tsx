import * as React from 'react';
import { cn } from '@/lib/utils';

// Lightweight, server-safe UI primitives styled with the command-center tokens.
// Interactive widgets live in their own 'use client' files.

// --------------------------------------------------------------------------- Card
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-[10px] border border-border bg-surface',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-4 py-3 border-b border-border', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-4', className)} {...props} />;
}

// --------------------------------------------------------------------------- Button
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // The ONE amber accent — reserved for the primary action only.
  primary: 'bg-accent text-accent-fg hover:brightness-95 font-medium',
  secondary: 'bg-surface-2 text-fg border border-border hover:bg-surface-2/70',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'text-status-rejected hover:bg-status-rejected/10 border border-transparent hover:border-status-rejected/40',
};

export function Button({
  className,
  variant = 'secondary',
  size = 'md',
  ...props
}: React.ComponentProps<'button'> & { variant?: ButtonVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md transition-colors',
        'disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

// --------------------------------------------------------------------------- Badge
export function Badge({
  className,
  colorToken = 'status-grey',
  children,
}: {
  className?: string;
  colorToken?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        'border',
        className,
      )}
      style={{
        color: `var(--color-${colorToken})`,
        borderColor: `color-mix(in srgb, var(--color-${colorToken}) 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, var(--color-${colorToken}) 12%, transparent)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: `var(--color-${colorToken})` }}
        aria-hidden
      />
      {children}
    </span>
  );
}

// --------------------------------------------------------------------------- Form fields
export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className={cn('block text-xs font-medium text-muted mb-1', className)}
      {...props}
    />
  );
}

const FIELD_BASE =
  'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg ' +
  'placeholder:text-faint focus:border-accent focus:outline-none transition-colors';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(FIELD_BASE, 'h-9', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(FIELD_BASE, 'min-h-[72px] resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select className={cn(FIELD_BASE, 'h-9 pr-8', className)} {...props}>
      {children}
    </select>
  );
}

// --------------------------------------------------------------------------- Misc
export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-border py-14 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-muted">{hint}</p> : null}
      {children}
    </div>
  );
}

export function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="rounded-[10px] border border-border bg-surface px-4 py-3">
      <div
        className={cn(
          'font-mono text-2xl leading-none',
          accent ? 'text-accent' : 'text-fg',
        )}
      >
        {value}
      </div>
      <div className="mt-1.5 text-xs text-muted">{label}</div>
    </div>
  );
}
