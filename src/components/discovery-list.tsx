'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import type { JobRow, JobState } from '@/types/database';
import type { ScoringChunkResult } from '@/lib/ai/types';
import { loadJobsPage } from '@/lib/actions/discovery';
import { promoteJob, setJobState } from '@/lib/actions/jobs';
import { cancelScoring, scoreOneJob, startScoring } from '@/lib/actions/scoring';
import { JobCard } from './job-card';
import { SkeletonJobCard } from './hud-skeleton';
import { EmptyState, Button } from './ui';
import { StatusLed } from './hud';

// A resumable run handed down from the server (status 'running' with jobs left).
export type ResumableRun = { runId: string; total: number; completed: number; failed: number };

// In-flight scoring-run progress (manual start OR resume).
type RunState = {
  runId: string;
  total: number;
  completed: number;
  failed: number;
  active: boolean;
  error?: string;
  cancelled?: boolean;
} | null;

// Client-owned discovery inbox: DB-paginated (infinite scroll via
// IntersectionObserver), optimistic save/dismiss/promote, and async AI scoring —
// a DB-tracked run is driven chunk-by-chunk via /api/scoring/chunk, each card's
// fit badge fills in as its chunk lands, the page never blocks on the batch, and
// the run survives navigation (resume offered) and can be cancelled.
export function DiscoveryList({
  initialJobs,
  state,
  params,
  aiEnabled,
  profileHash,
  initialDone,
  initialOffset,
  hasFilters,
  emptyTitle,
  emptyHint,
  resumableRun = null,
}: {
  initialJobs: JobRow[];
  state: JobState;
  params: Record<string, string>;
  aiEnabled: boolean;
  profileHash: string | null;
  initialDone: boolean;
  initialOffset: number;
  hasFilters: boolean;
  emptyTitle: string;
  emptyHint: string;
  resumableRun?: ResumableRun | null;
}) {
  const [jobs, setJobs] = useState<JobRow[]>(initialJobs);
  const [offset, setOffset] = useState(initialOffset);
  const [done, setDone] = useState(initialDone);
  const [loadingMore, setLoadingMore] = useState(false);

  const [scoring, setScoring] = useState<Record<string, boolean>>({});
  const [scoreErr, setScoreErr] = useState<Record<string, string | null>>({});
  const [mutating, setMutating] = useState<Record<string, boolean>>({});
  const [run, setRun] = useState<RunState>(null);
  const cancelRef = useRef(false);
  const [, startMutate] = useTransition();

  // ---- Pagination (IntersectionObserver sentinel) ----------------------------
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const page = await loadJobsPage({ state, params, offset });
      setJobs((prev) => {
        const seen = new Set(prev.map((j) => j.id));
        return [...prev, ...page.jobs.filter((j) => !seen.has(j.id))];
      });
      setOffset(page.nextOffset);
      setDone(page.done);
    } finally {
      setLoadingMore(false);
    }
  }, [state, params, offset]);

  // Keep the observer callback pointing at the latest loadMore + busy flag
  // without re-creating the observer every render (synced in an effect, never
  // mutated during render).
  const loadMoreRef = useRef(loadMore);
  const busyRef = useRef(false);
  useEffect(() => {
    loadMoreRef.current = loadMore;
    busyRef.current = loadingMore || done;
  });

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !busyRef.current) void loadMoreRef.current();
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ---- Optimistic state mutations -------------------------------------------
  const mutateState = useCallback(
    (job: JobRow, next: JobState) => {
      const snapshot = jobs;
      startMutate(() => {
        setMutating((m) => ({ ...m, [job.id]: true }));
        setJobs((prev) =>
          next === state
            ? prev.map((j) => (j.id === job.id ? { ...j, state: next } : j))
            : prev.filter((j) => j.id !== job.id),
        );
      });
      setJobState(job.id, next)
        .catch(() => setJobs(snapshot))
        .finally(() => setMutating((m) => ({ ...m, [job.id]: false })));
    },
    [jobs, state],
  );

  const promote = useCallback(
    (job: JobRow) => {
      const snapshot = jobs;
      startMutate(() => {
        setMutating((m) => ({ ...m, [job.id]: true }));
        setJobs((prev) => prev.filter((j) => j.id !== job.id));
      });
      promoteJob(job.id)
        .then((res) => {
          if (!res.ok) {
            setJobs(snapshot);
            alert(res.error ?? 'Could not promote job.');
          }
        })
        .catch(() => setJobs(snapshot))
        .finally(() => setMutating((m) => ({ ...m, [job.id]: false })));
    },
    [jobs],
  );

  // ---- Scoring ---------------------------------------------------------------
  const scoreOne = useCallback(async (job: JobRow): Promise<boolean> => {
    const force = job.fit_score != null;
    setScoring((s) => ({ ...s, [job.id]: true }));
    setScoreErr((e) => ({ ...e, [job.id]: null }));
    try {
      const res = await scoreOneJob(job.id, { force });
      if (res.ok) {
        if (res.fit) {
          setJobs((prev) =>
            prev.map((j) => (j.id === job.id ? ({ ...j, ...res.fit } as JobRow) : j)),
          );
        }
        return true;
      }
      setScoreErr((e) => ({ ...e, [job.id]: res.error }));
      return false;
    } finally {
      setScoring((s) => ({ ...s, [job.id]: false }));
    }
  }, []);

  const isStale = useCallback(
    (j: JobRow) => j.fit_score == null || (profileHash != null && j.scored_profile_hash !== profileHash),
    [profileHash],
  );

  // Drive a run to completion: POST /api/scoring/chunk until done, merging each
  // chunk's fit columns into the loaded cards and updating progress. The whole
  // batch never blocks — the user can keep scrolling, acting, or cancel.
  const pump = useCallback(async (runId: string) => {
    for (;;) {
      if (cancelRef.current) {
        setRun((r) => (r ? { ...r, active: false, cancelled: true } : r));
        return;
      }
      let data: ScoringChunkResult;
      try {
        const resp = await fetch('/api/scoring/chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId }),
        });
        data = (await resp.json()) as ScoringChunkResult;
      } catch {
        setRun((r) => (r ? { ...r, active: false, error: 'Network error during scoring.' } : r));
        return;
      }
      if (data.updated?.length) {
        const byId = new Map(data.updated.map((u) => [u.id, u]));
        setJobs((prev) =>
          prev.map((j) => {
            const u = byId.get(j.id);
            return u ? ({ ...j, ...u } as JobRow) : j;
          }),
        );
      }
      const finished = data.done || !data.ok;
      setRun((r) =>
        r
          ? {
              ...r,
              completed: data.completed,
              failed: data.failed,
              total: data.total,
              active: !finished,
              error: data.error ?? r.error,
            }
          : r,
      );
      if (finished) return;
    }
  }, []);

  const startRun = useCallback(async () => {
    cancelRef.current = false;
    setRun({ runId: '', total: 0, completed: 0, failed: 0, active: true });
    const res = await startScoring();
    if (!res.ok) {
      setRun({ runId: '', total: 0, completed: 0, failed: 0, active: false, error: res.error });
      return;
    }
    if (res.total === 0 || !res.runId) {
      setRun({ runId: '', total: 0, completed: 0, failed: 0, active: false });
      return;
    }
    setRun({ runId: res.runId, total: res.total, completed: 0, failed: 0, active: true });
    await pump(res.runId);
  }, [pump]);

  const resumeRun = useCallback(
    async (r: ResumableRun) => {
      cancelRef.current = false;
      setRun({ ...r, active: true });
      await pump(r.runId);
    },
    [pump],
  );

  const cancelRun = useCallback((runId: string) => {
    cancelRef.current = true;
    setRun((r) => (r ? { ...r, active: false, cancelled: true } : r));
    void cancelScoring(runId);
  }, []);

  const staleCount = jobs.filter(isStale).length;
  const showResume = run === null && resumableRun !== null;

  // ---- Render ----------------------------------------------------------------
  if (jobs.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-faint">
          <span className="font-mono">{jobs.length}</span>
          {done ? '' : '+'} {hasFilters ? 'shown' : `job${jobs.length === 1 ? '' : 's'}`}
        </p>
        {aiEnabled ? (
          <div className="flex items-center gap-2">
            {run ? (
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                {run.active ? <StatusLed colorToken="system" alert size={6} /> : null}
                {run.error ? (
                  <span className="text-status-rejected">{run.error}</span>
                ) : run.cancelled ? (
                  `cancelled · ${run.completed} scored`
                ) : run.total === 0 ? (
                  'all scored'
                ) : (
                  `scored ${run.completed} / ${run.total}${run.failed ? ` · ${run.failed} failed` : ''}`
                )}
              </span>
            ) : null}

            {run?.active && run.runId ? (
              <Button variant="ghost" size="sm" onClick={() => cancelRun(run.runId)}>
                Cancel
              </Button>
            ) : showResume && resumableRun ? (
              <Button
                variant="secondary"
                size="sm"
                title="Resume the in-progress scoring run"
                onClick={() => resumeRun(resumableRun)}
              >
                ↻ Resume scoring ({Math.max(0, resumableRun.total - resumableRun.completed - resumableRun.failed)})
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={run?.active || staleCount === 0}
                title="Scoring runs on your own Anthropic API key"
                onClick={startRun}
              >
                {run?.active ? 'Scoring…' : `✦ Score new${staleCount ? ` (${staleCount})` : ''}`}
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            aiEnabled={aiEnabled}
            currentProfileHash={profileHash}
            stateControl={{
              pending: Boolean(mutating[job.id]),
              onSetState: (next) => mutateState(job, next),
              onPromote: () => promote(job),
            }}
            scoreControl={{
              pending: Boolean(scoring[job.id]),
              error: scoreErr[job.id] ?? null,
              onScore: () => void scoreOne(job),
            }}
          />
        ))}
      </div>

      {/* Infinite-scroll sentinel + a small skeleton batch while the next page loads. */}
      {!done ? (
        <div ref={sentinelRef}>
          {loadingMore ? (
            <div className="grid gap-3">
              <SkeletonJobCard />
              <SkeletonJobCard />
            </div>
          ) : (
            <div className="h-8" aria-hidden />
          )}
        </div>
      ) : null}
    </div>
  );
}
