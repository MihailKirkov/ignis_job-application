import type { SourceType } from '@/types/database';
import type { FetchContext, NormalizedJob } from './types';
import { fetchAdzuna } from './adzuna';
import { fetchArbeitnow } from './arbeitnow';
import { fetchRemotive } from './remotive';
import { fetchRemoteOk } from './remoteok';
import { fetchGreenhouse } from './greenhouse';
import { fetchLever } from './lever';
import { fetchAshby } from './ashby';
import { fetchWorkable } from './workable';

export type SourceFetcher = (
  config: Record<string, unknown>,
  ctx: FetchContext,
) => Promise<NormalizedJob[]>;

export const SOURCE_FETCHERS: Record<SourceType, SourceFetcher> = {
  adzuna: fetchAdzuna,
  arbeitnow: fetchArbeitnow,
  remotive: fetchRemotive,
  remoteok: fetchRemoteOk,
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
  workable: fetchWorkable,
};

export function getFetcher(type: SourceType): SourceFetcher | undefined {
  return SOURCE_FETCHERS[type];
}

// Build the fetch context from server env (Adzuna keys). Never import this into
// client code.
export function serverFetchContext(): FetchContext {
  return {
    adzunaAppId: process.env.ADZUNA_APP_ID,
    adzunaAppKey: process.env.ADZUNA_APP_KEY,
  };
}

export * from './types';
