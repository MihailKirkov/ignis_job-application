'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { StatusLed } from './hud';

// `view` marks the segments the public /demo can render (Needs-action / Tracker /
// Discovery). Items without a `view` are real-app only — in demo mode they show as
// locked teasers that route to sign-in.
const NAV = [
  { href: '/needs-action', label: 'Needs action', code: 'Q', view: 'needs-action' },
  { href: '/tracker', label: 'Tracker', code: 'T', view: 'tracker' },
  { href: '/discovery', label: 'Discovery', code: 'D', view: 'discovery' },
  { href: '/sources', label: 'Sources', code: 'S' },
  { href: '/activity', label: 'Activity', code: 'A' },
  { href: '/profile', label: 'Profile', code: 'P' },
] as const;

function Brand() {
  return (
    <div className="relative px-3 py-3">
      <div className="flex items-center gap-2">
        <StatusLed colorToken="system" alert size={9} />
        <span className="font-mono text-[11px] tracking-[0.25em] text-system">
          JOB · CC
        </span>
      </div>
      <div className="mt-1 text-sm font-semibold text-fg">Command Center</div>
      <div className="hud-rule mt-3" aria-hidden />
    </div>
  );
}

export function SideNav({
  email,
  needsActionCount,
  demo = false,
  activeView,
}: {
  email?: string;
  needsActionCount: number;
  // In demo mode the nav routes within /demo, locks the real-app-only segments,
  // and swaps the account footer for a sign-in CTA.
  demo?: boolean;
  activeView?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <Brand />

      <ul className="mt-1 flex flex-col gap-0.5">
        {NAV.map((item) => {
          const locked = demo && !('view' in item);
          const active = demo
            ? 'view' in item && activeView === item.view
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const href = demo && 'view' in item ? `/demo?view=${item.view}` : item.href;
          const badge =
            item.href === '/needs-action' && needsActionCount > 0 ? (
              <span
                className="bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-fg"
                style={{ boxShadow: 'var(--glow-accent)' }}
              >
                {needsActionCount}
              </span>
            ) : null;

          const inner = (
            <>
              <span className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'h-4 w-0.5 rounded-full transition-all',
                    active ? 'bg-system' : 'bg-transparent',
                  )}
                  style={active ? { boxShadow: 'var(--glow-system)' } : undefined}
                  aria-hidden
                />
                {item.label}
              </span>
              {badge ??
                (locked ? (
                  <span className="font-mono text-[10px] text-faint" aria-hidden>
                    🔒
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-faint opacity-0 transition-opacity group-hover:opacity-100">
                    {item.code}
                  </span>
                ))}
            </>
          );

          return (
            <li key={item.href}>
              {locked ? (
                <Link
                  href="/login"
                  title="Sign in to use this"
                  className="group relative flex items-center justify-between px-3 py-2 text-sm text-faint transition-colors hover:text-muted"
                >
                  {inner}
                </Link>
              ) : (
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center justify-between px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-surface-2 text-fg'
                      : 'text-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-3">
        <div className="hud-rule mb-3" aria-hidden />
        {demo ? (
          <div className="px-1">
            <Link
              href="/login"
              className="hud-cut flex h-9 w-full items-center justify-center bg-accent px-3 text-sm font-medium text-accent-fg transition-[filter] hover:brightness-95"
            >
              Get started — sign in
            </Link>
            <p className="mt-2 px-2 text-[11px] leading-relaxed text-faint">
              Read-only demo with sample data. Sign in to ingest real jobs and run
              your own pipeline.
            </p>
            <Link
              href="/"
              className="mt-1 block px-2 text-xs text-muted transition-colors hover:text-fg"
            >
              ← Back to home
            </Link>
          </div>
        ) : (
          <>
            <Link
              href="/legal"
              className="block px-3 pb-1 text-xs text-faint transition-colors hover:text-muted"
            >
              Sources &amp; attribution
            </Link>
            <div className="truncate px-3 font-mono text-[11px] text-faint" title={email}>
              {email}
            </div>
            <form action="/auth/signout" method="post" className="mt-1">
              <button
                type="submit"
                className="w-full px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                Sign out
              </button>
            </form>
          </>
        )}
      </div>
    </nav>
  );
}

// Mobile top bar nav (simple horizontal scroller).
export function MobileNav({
  demo = false,
  activeView,
}: {
  demo?: boolean;
  activeView?: string;
} = {}) {
  const pathname = usePathname();
  // In demo, only the three demo-able segments are reachable.
  const items = demo ? NAV.filter((item) => 'view' in item) : NAV;
  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 md:hidden">
      {items.map((item) => {
        const active = demo
          ? 'view' in item && activeView === item.view
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const href = demo && 'view' in item ? `/demo?view=${item.view}` : item.href;
        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              'whitespace-nowrap px-3 py-1.5 text-sm transition-colors',
              active
                ? 'border border-system/40 bg-surface-2 text-fg'
                : 'text-muted',
            )}
          >
            {item.label}
          </Link>
        );
      })}
      {demo ? (
        <Link
          href="/login"
          className="hud-cut ml-auto whitespace-nowrap bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
        >
          Sign in
        </Link>
      ) : null}
    </nav>
  );
}
