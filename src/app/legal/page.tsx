import Link from 'next/link';

export const metadata = { title: 'Sources & attribution' };

const SOURCES = [
  { name: 'Adzuna', url: 'https://www.adzuna.com', note: 'Official jobs API.' },
  { name: 'Arbeitnow', url: 'https://www.arbeitnow.com', note: 'Free public job-board API.' },
  {
    name: 'Remotive',
    url: 'https://remotive.com',
    note: 'Remote jobs courtesy of Remotive — data delayed 24h.',
  },
  {
    name: 'RemoteOK',
    url: 'https://remoteok.com',
    note: 'Remote jobs courtesy of RemoteOK.',
  },
  { name: 'Greenhouse', url: 'https://www.greenhouse.io', note: 'Public job-board API.' },
  { name: 'Lever', url: 'https://www.lever.co', note: 'Public postings API.' },
  { name: 'Ashby', url: 'https://www.ashbyhq.com', note: 'Public posting API.' },
  { name: 'Workable', url: 'https://www.workable.com', note: 'Public careers API.' },
  { name: 'Recruitee', url: 'https://www.recruitee.com', note: 'Public Careers Site API.' },
  {
    name: 'SmartRecruiters',
    url: 'https://www.smartrecruiters.com',
    note: 'Public Posting API.',
  },
];

export default function LegalPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-muted hover:text-fg">
        ← Back
      </Link>
      <h1 className="mt-4 text-xl font-semibold text-fg">Sources &amp; attribution</h1>
      <p className="mt-2 text-sm text-muted">
        Job postings are aggregated from the official APIs and public job-board
        endpoints below, each linked back to its origin. No scraping, no bypassing
        access controls.
      </p>
      <ul className="mt-6 space-y-3">
        {SOURCES.map((s) => (
          <li key={s.name} className="border border-system/20 bg-surface p-3">
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-fg hover:text-accent"
            >
              {s.name} ↗
            </a>
            <p className="text-xs text-muted">{s.note}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
