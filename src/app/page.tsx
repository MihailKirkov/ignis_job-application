import Link from 'next/link';
import { getUser } from '@/lib/supabase/auth';
import { JobCard } from '@/components/job-card';
import { DEMO_JOBS } from '@/lib/demo/fixtures';

const FEATURES = [
  {
    title: 'Discovery ingestion',
    body: 'Pull roles from official APIs and public ATS boards — Adzuna, Recruitee, SmartRecruiters, Greenhouse, Lever and more — normalized, deduped, into one inbox.',
  },
  {
    title: 'AI fit-scoring',
    body: 'Score every job against your profile and CV with Claude. A 0–100 fit, a one-line verdict, and the matched skills vs. gaps — best fit floats to the top.',
  },
  {
    title: 'Pipeline tracker',
    body: 'Run applications through a real pipeline with a “needs action” queue as the hero: due and overdue follow-ups surfaced first, one click to clear.',
  },
];

export default async function Home() {
  const user = await getUser();
  // The single best job, used as a live preview "screenshot".
  const preview = [...DEMO_JOBS].sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0))[0];

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 md:px-8">
        <div className="font-mono text-xs tracking-widest text-accent">JOB · CC</div>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/demo" className="px-3 py-1.5 text-muted transition-colors hover:text-fg">
            Demo
          </Link>
          {user ? (
            <Link
              href="/needs-action"
              className="inline-flex h-8 items-center rounded-md bg-accent px-3 font-medium text-accent-fg transition-[filter] hover:brightness-95"
            >
              Open app
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-8 items-center rounded-md border border-border bg-surface-2 px-3 text-fg transition-colors hover:bg-surface-2/70"
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-8 pt-10 md:px-8 md:pt-16">
        <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              A command center for your job hunt
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-fg md:text-4xl">
              Ingest jobs, score the fit with AI, and run your whole pipeline in one
              dark, dense inbox.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted md:text-base">
              Job Command Center pulls roles from legitimate APIs and public ATS
              boards, ranks them against your profile with Claude, and tracks every
              application from “to apply” to offer — so nothing slips.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/demo"
                className="inline-flex h-10 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-fg transition-[filter] hover:brightness-95"
              >
                Try the demo →
              </Link>
              <Link
                href={user ? '/needs-action' : '/login'}
                className="inline-flex h-10 items-center rounded-md border border-border bg-surface-2 px-5 text-sm text-fg transition-colors hover:bg-surface-2/70"
              >
                {user ? 'Open app' : 'Sign in'}
              </Link>
            </div>
            <p className="mt-3 text-xs text-faint">
              No sign-up needed to explore the demo — it’s read-only sample data.
            </p>
          </div>

          {/* Live preview, framed like an app window. */}
          <div className="rounded-[12px] border border-border bg-surface p-2 shadow-2xl shadow-black/40">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-status-rejected/70" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-status-interview/70" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-status-offer/70" aria-hidden />
              <span className="ml-2 font-mono text-[10px] text-faint">discovery · fit-scored</span>
            </div>
            <div className="rounded-[10px] bg-bg p-3">
              <JobCard job={preview} readOnly />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="rounded-[10px] border border-border bg-surface p-5">
              <div className="font-mono text-xs text-accent">0{i + 1}</div>
              <h3 className="mt-2 text-sm font-semibold text-fg">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="mx-auto max-w-5xl px-4 pb-16 md:px-8">
        <div className="flex flex-col items-center gap-4 rounded-[12px] border border-border bg-surface px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-fg">See it with sample data</h2>
          <p className="max-w-md text-sm text-muted">
            Walk the Discovery inbox, the Tracker, and the Needs-action queue —
            populated, scored, and read-only. No account required.
          </p>
          <Link
            href="/demo"
            className="inline-flex h-10 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-fg transition-[filter] hover:brightness-95"
          >
            Open the demo →
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-faint md:px-8">
          <span>Next.js 16 · Supabase · Tailwind v4 · Claude</span>
          <div className="flex items-center gap-4">
            <Link href="/legal" className="transition-colors hover:text-muted">
              Sources &amp; attribution
            </Link>
            <Link href="/demo" className="transition-colors hover:text-muted">
              Demo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
