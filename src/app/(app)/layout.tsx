import { requireUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { TERMINAL_STATUSES } from '@/lib/constants';
import { todayISO } from '@/lib/utils';
import { MobileNav, SideNav } from '@/components/app-shell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  // Count for the sidebar "Needs action" badge.
  const { count } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .lte('next_action_date', todayISO())
    .not('status', 'in', `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`);

  return (
    <div className="md:grid md:grid-cols-[240px_1fr] md:h-dvh">
      <aside className="hidden border-r border-border bg-surface md:block">
        <SideNav email={user.email ?? ''} needsActionCount={count ?? 0} />
      </aside>
      <MobileNav />
      <main className="min-w-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
