'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/needs-action', label: 'Needs action', hint: 'Q' },
  { href: '/tracker', label: 'Tracker', hint: 'T' },
  { href: '/discovery', label: 'Discovery', hint: 'D' },
  { href: '/sources', label: 'Sources', hint: 'S' },
];

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
      <div className="px-2 py-3">
        <div className="font-mono text-xs tracking-widest text-accent">JOB · CC</div>
        <div className="mt-0.5 text-sm font-semibold text-fg">Command Center</div>
      </div>

      <ul className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-surface-2 text-fg'
                    : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <span className="flex items-center gap-2">
                  {active && (
                    <span className="h-4 w-0.5 rounded-full bg-accent" aria-hidden />
                  )}
                  <span className={cn(!active && 'pl-2.5')}>{item.label}</span>
                </span>
                {item.href === '/needs-action' && needsActionCount > 0 ? (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-fg">
                    {needsActionCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto border-t border-border pt-3">
        <Link
          href="/legal"
          className="block px-3 pb-1 text-xs text-faint transition-colors hover:text-muted"
        >
          Sources &amp; attribution
        </Link>
        <div className="truncate px-3 text-xs text-faint" title={email}>
          {email}
        </div>
        <form action="/auth/signout" method="post" className="mt-1">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg"
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
              'whitespace-nowrap rounded-md px-3 py-1.5 text-sm',
              active ? 'bg-surface-2 text-fg' : 'text-muted',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
