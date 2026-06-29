import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { OUTREACH_STATUS_COLOR } from '@/lib/constants';
import { formatDate, isDueOrOverdue } from '@/lib/utils';
import type {
  ApplicationRow,
  CompanyRow,
  ContactRow,
  MessageTemplateRow,
  OutreachRow,
} from '@/types/database';
import { HudFrame, SectionLabel, StatReadout, StatusLed } from '@/components/hud';
import { NewContactButton } from '@/components/contact-dialog';
import { NewCompanyButton, EditCompanyButton } from '@/components/company-dialog';
import { DeleteCompanyButton } from '@/components/contact-actions';
import { LogOutreachButton } from '@/components/outreach-dialog';
import { OutreachStatusSelect } from '@/components/outreach-actions';
import { ContactsConsole } from '@/components/contacts-console';
import { EmptyState } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';

// Strip characters that would break PostgREST `.or()` filter syntax.
function sanitize(q: string): string {
  return q.replace(/[,()*]/g, ' ').trim();
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company: companyParam } = await searchParams;
  const supabase = await createClient();

  const { data: companyRows } = await supabase
    .from('companies')
    .select('*')
    .order('name', { ascending: true });
  const companies = (companyRows ?? []) as CompanyRow[];
  const companyNames: Record<string, string> = {};
  for (const c of companies) companyNames[c.id] = c.name;
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));

  const selected = companyParam ? companies.find((c) => c.id === companyParam) : undefined;

  // Outreach templates feed the composer's "Template" picker (fill + AI personalize).
  const { data: templateRows } = await supabase
    .from('message_templates')
    .select('id, name')
    .order('created_at', { ascending: false });
  const templates = (templateRows ?? []) as Pick<MessageTemplateRow, 'id' | 'name'>[];

  let contactsQuery = supabase.from('contacts').select('*');
  if (selected) contactsQuery = contactsQuery.eq('company_id', selected.id);
  const { data: contactRows } = await contactsQuery.order('name', { ascending: true });
  const contacts = (contactRows ?? []) as ContactRow[];

  // Stats (all contacts, regardless of the company filter).
  const { count: totalContacts } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true });
  const { data: followRows } = await supabase
    .from('contacts')
    .select('next_follow_up_at')
    .not('next_follow_up_at', 'is', null);
  const followDue = (followRows ?? []).filter((r) =>
    isDueOrOverdue(r.next_follow_up_at as string | null),
  ).length;

  // Linked applications + outreach timeline for the selected company.
  let linkedApps: ApplicationRow[] = [];
  let companyOutreach: OutreachRow[] = [];
  if (selected) {
    const name = sanitize(selected.name);
    let q = supabase.from('applications').select('*');
    q = name
      ? q.or(`company_id.eq.${selected.id},company.ilike.%${name}%`)
      : q.eq('company_id', selected.id);
    const [{ data: apps }, { data: outreach }] = await Promise.all([
      q.order('status', { ascending: true }),
      supabase
        .from('outreach')
        .select('*')
        .eq('company_id', selected.id)
        .order('sent_at', { ascending: false })
        .limit(20),
    ]);
    linkedApps = (apps ?? []) as ApplicationRow[];
    companyOutreach = (outreach ?? []) as OutreachRow[];
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="hud-label">NETWORK</p>
          <h1 className="mt-1.5 text-xl font-semibold text-fg">Contacts</h1>
        </div>
        <div className="flex items-center gap-2">
          <NewCompanyButton />
          <NewContactButton companies={companyOptions} presetCompanyName={selected?.name} />
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <StatReadout label="CONTACTS" value={totalContacts ?? 0} index="C1" />
        <StatReadout label="COMPANIES" value={companies.length} index="C2" />
        <StatReadout
          label="FOLLOW-UPS DUE"
          value={followDue}
          index="C3"
          active={followDue > 0}
          colorToken={followDue > 0 ? 'accent' : 'system'}
          ledAlert={followDue > 0}
        />
      </div>

      {companies.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <SectionLabel className="mr-1 text-faint">COMPANY</SectionLabel>
          <Link
            href="/contacts"
            className={
              'border px-2.5 py-1 font-mono text-xs transition-colors ' +
              (!selected
                ? 'border-system/60 bg-surface-2 text-system'
                : 'border-border text-muted hover:border-system/40 hover:text-fg')
            }
          >
            All
          </Link>
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/contacts?company=${c.id}`}
              className={
                'border px-2.5 py-1 font-mono text-xs transition-colors ' +
                (selected?.id === c.id
                  ? 'border-system/60 bg-surface-2 text-system'
                  : 'border-border text-muted hover:border-system/40 hover:text-fg')
              }
            >
              {c.name}
            </Link>
          ))}
        </div>
      ) : null}

      {selected ? (
        <HudFrame
          label={`COMPANY · ${selected.name.toUpperCase()}`}
          chamfer={['tl', 'br']}
          accentCorner="tl"
          node
          right={
            <span className="flex items-center gap-1">
              <LogOutreachButton
                ctx={{ companyId: selected.id, companyName: selected.name }}
                templates={templates}
                label="+ Outreach"
                title={`Log outreach · ${selected.name}`}
              />
              <EditCompanyButton row={selected} />
              <DeleteCompanyButton id={selected.id} />
            </span>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <dl className="space-y-1.5 font-mono text-xs">
              <Detail label="WEBSITE">
                {selected.website ? (
                  <a
                    href={selected.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-system transition-colors hover:underline"
                  >
                    {selected.website.replace(/^https?:\/\/(www\.)?/i, '')}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label="LOCATION">{selected.location ?? '—'}</Detail>
              <Detail label="ATS">{selected.ats_type ?? '—'}</Detail>
              {selected.notes ? (
                <Detail label="NOTES">
                  <span className="text-muted">{selected.notes}</span>
                </Detail>
              ) : null}
            </dl>
            <div>
              <SectionLabel className="text-faint">
                LINKED APPLICATIONS · {linkedApps.length}
              </SectionLabel>
              <ul className="mt-2 space-y-1.5">
                {linkedApps.length === 0 ? (
                  <li className="font-mono text-xs text-faint">No linked applications.</li>
                ) : (
                  linkedApps.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs text-fg" title={a.role}>
                        {a.link ? (
                          <a
                            href={a.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors hover:text-system"
                          >
                            {a.role}
                          </a>
                        ) : (
                          a.role
                        )}
                      </span>
                      <StatusBadge status={a.status} />
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <SectionLabel className="text-faint">OUTREACH · {companyOutreach.length}</SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {companyOutreach.length === 0 ? (
                <li className="font-mono text-xs text-faint">
                  No outreach logged — use + Outreach above.
                </li>
              ) : (
                companyOutreach.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-3 font-mono text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <StatusLed colorToken={OUTREACH_STATUS_COLOR[o.status]} size={6} />
                      <span className="shrink-0 tabular-nums text-faint">
                        {formatDate(o.sent_at)}
                      </span>
                      <span className="truncate text-fg" title={o.subject ?? undefined}>
                        {o.subject ?? o.channel ?? 'Outreach'}
                      </span>
                      {o.next_bump_at ? (
                        <span className="shrink-0 text-faint">· bump {formatDate(o.next_bump_at)}</span>
                      ) : null}
                    </span>
                    <OutreachStatusSelect id={o.id} status={o.status} companyName={selected.name} />
                  </li>
                ))
              )}
            </ul>
          </div>
        </HudFrame>
      ) : null}

      {contacts.length === 0 ? (
        <EmptyState
          title={selected ? `No contacts at ${selected.name}` : 'No contacts yet'}
          hint={
            selected
              ? 'Add a contact and set their company to this name.'
              : 'Save the people you meet — recruiters, hiring managers, referrals — and track when to follow up.'
          }
        />
      ) : (
        <ContactsConsole
          contacts={contacts}
          companyNames={companyNames}
          companies={companyOptions}
          templates={templates}
        />
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-faint">{label}</dt>
      <dd className="min-w-0 truncate text-fg">{children}</dd>
    </div>
  );
}
