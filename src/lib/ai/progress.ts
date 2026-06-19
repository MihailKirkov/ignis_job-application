// Pure chunk-progress accounting for a scoring run. Kept free of DB/SDK so the
// termination logic (how many to fetch next, when a run is done) is unit-tested.

// How many jobs to fetch for the next chunk: the remaining run budget, bounded by
// the chunk size. Never negative.
export function chunkLimit(
  total: number,
  completed: number,
  failed: number,
  chunkSize: number,
): number {
  return Math.max(0, Math.min(chunkSize, total - completed - failed));
}

export type ChunkTally = {
  completed: number;
  failed: number;
  remaining: number;
  done: boolean;
};

// Fold one processed chunk into the running totals.
//   scoredCount   — jobs in this chunk the model returned a score for
//   fetchedCount  — jobs actually fetched for this chunk (≤ limit)
//   limit         — how many we asked for (from chunkLimit)
// A run is done when the budget is exhausted OR a short read means no jobs remain.
export function settleChunk(args: {
  total: number;
  completedBefore: number;
  failedBefore: number;
  scoredCount: number;
  fetchedCount: number;
  limit: number;
}): ChunkTally {
  const { total, completedBefore, failedBefore, scoredCount, fetchedCount, limit } = args;
  const completed = completedBefore + scoredCount;
  const failed = failedBefore + (fetchedCount - scoredCount);
  const processed = completed + failed;
  const remaining = Math.max(0, total - processed);
  const done = processed >= total || fetchedCount < limit;
  return { completed, failed, remaining, done };
}
