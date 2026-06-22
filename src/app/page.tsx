import type { Metadata } from 'next';
import Link from 'next/link';
import { getUser } from '@/lib/supabase/auth';

const LANDING_DESCRIPTION =
  'Ingest jobs from legitimate APIs and public ATS boards, score each against your profile and CV with Claude, and run every application from “to apply” to offer in one dense inbox.';

export const metadata: Metadata = {
  title: { absolute: 'Job Command Center — AI-scored job discovery & tracker' },
  description: LANDING_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Job Command Center',
    locale: 'en',
    url: '/',
    title: 'Job Command Center — AI-scored job discovery & tracker',
    description: LANDING_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Job Command Center — AI-scored job discovery & tracker',
    description: LANDING_DESCRIPTION,
  },
};
import { JobCard } from '@/components/job-card';
import { HudFrame } from '@/components/hud-frame';
import { StatusLed } from '@/components/hud';
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
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <div className="flex items-center gap-2">
          <StatusLed colorToken="system" alert size={9} />
          <span className="font-mono text-[11px] tracking-[0.25em] text-system">JOB · CC</span>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/demo" className="px-3 py-1.5 text-muted transition-colors hover:text-fg">
            Demo
          </Link>
          {user ? (
            <Link
              href="/needs-action"
              className="hud-cut inline-flex h-8 items-center bg-accent px-3 font-medium text-accent-fg transition-[filter] hover:brightness-95"
            >
              Open app
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-8 items-center border border-system/30 bg-surface-2 px-3 text-fg transition-colors hover:border-system/60 hover:text-system"
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-10 md:px-8 md:pt-16">
        <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 border border-system/30 bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-muted">
              <StatusLed colorToken="system" alert size={7} />
              A command center for your job hunt
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-fg md:text-4xl">
              Ingest jobs, score the fit with AI, and run your whole pipeline in one
              modern, dense inbox.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted md:text-base">
              Job Command Center pulls roles from legitimate APIs and public ATS
              boards, ranks them against your profile with Claude, and tracks every
              application from “to apply” to offer — so nothing slips.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/demo"
                className="hud-cut inline-flex h-10 items-center bg-accent px-5 text-sm font-medium text-accent-fg transition-[filter] hover:brightness-95"
              >
                Try the demo →
              </Link>
              <Link
                href={user ? '/needs-action' : '/login'}
                className="inline-flex h-10 items-center border border-system/30 bg-surface-2 px-5 text-sm text-fg transition-colors hover:border-system/60 hover:text-system"
              >
                {user ? 'Open app' : 'Sign in'}
              </Link>
            </div>
            <p className="mt-3 font-mono text-[11px] text-faint">
              No sign-up needed to explore the demo — it’s read-only sample data.
            </p>
          </div>

          {/* Live preview — a real fit-scored Discovery card in an app-window frame. */}
          <HudFrame
            chamfer={['tl', 'br']}
            accentCorner="tl"
            accentTone="status-offer"
            node
            flush
            className="shadow-2xl shadow-black/40"
          >
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <span className="hud-label">DISCOVERY · FIT-SCORED</span>
              <span className="font-mono text-[10px] text-faint">LIVE</span>
            </div>
            <div
              className="mx-3.5 h-px"
              style={{
                background:
                  'linear-gradient(to right, color-mix(in srgb, var(--color-system) 50%, transparent), transparent)',
              }}
              aria-hidden
            />
            <div className="p-3.5">
              <JobCard job={preview} readOnly />
            </div>
          </HudFrame>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <HudFrame
              key={f.title}
              chamfer={['tl']}
              label={`0${i + 1}`}
              className="h-full"
            >
              <h3 className="text-sm font-semibold text-fg">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
            </HudFrame>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-8">
        <HudFrame
          chamfer={['tl', 'br']}
          accentCorner="tl"
          accentTone="accent"
          node
          bodyClassName="flex flex-col items-center gap-4 px-6 py-10 text-center"
        >
          <span className="hud-label">READY WHEN YOU ARE</span>
          <h2 className="text-lg font-semibold text-fg">See it with sample data</h2>
          <p className="max-w-md text-sm text-muted">
            Walk the Discovery inbox, the Tracker, and the Needs-action queue —
            populated, scored, and read-only. No account required.
          </p>
          <Link
            href="/demo"
            className="hud-cut inline-flex h-10 items-center bg-accent px-5 text-sm font-medium text-accent-fg transition-[filter] hover:brightness-95"
          >
            Open the demo →
          </Link>
        </HudFrame>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-faint md:px-8">
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
