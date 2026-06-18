'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { StatusLed } from './hud';

const NAV = [
  { href: '/needs-action', label: 'Needs action', code: 'Q' },
  { href: '/tracker', label: 'Tracker', code: 'T' },
  { href: '/discovery', label: 'Discovery', code: 'D' },
  { href: '/sources', label: 'Sources', code: 'S' },
  { href: '/activity', label: 'Activity', code: 'A' },
  { href: '/profile', label: 'Profile', code: 'P' },
];

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
}: {
  email: string;
  needsActionCount: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <Brand />

      <ul className="mt-1 flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center justify-between px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-surface-2 text-fg'
                    : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
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
                {item.href === '/needs-action' && needsActionCount > 0 ? (
                  <span
                    className="bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-fg"
                    style={{ boxShadow: 'var(--glow-accent)' }}
                  >
                    {needsActionCount}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-faint opacity-0 transition-opacity group-hover:opacity-100">
                    {item.code}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-3">
        <div className="hud-rule mb-3" aria-hidden />
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
      </div>
    </nav>
  );
}

// Mobile top bar nav (simple horizontal scroller).
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 md:hidden">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
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
    </nav>
  );
}
