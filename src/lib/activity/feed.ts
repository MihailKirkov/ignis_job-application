import type { ActivityEventRow } from '@/types/database';

// Where a feed line should link. Pure + dependency-free so both the telemetry
// strip and the /activity page can share it. Ingestion events deep-link to the
// run detail on /activity; everything else points at its surface.
export function activityHref(event: Pick<ActivityEventRow, 'category' | 'meta'>): string {
  switch (event.category) {
    case 'application':
      return '/tracker';
    case 'job':
      return '/discovery';
    case 'profile':
      return '/profile';
    case 'source':
      return '/sources';
    case 'company': {
      const companyId =
        typeof event.meta?.company_id === 'string' ? event.meta.company_id : undefined;
      return companyId ? `/contacts?company=${companyId}` : '/contacts';
    }
    case 'contact':
      return '/contacts';
    case 'outreach': {
      const companyId =
        typeof event.meta?.company_id === 'string' ? event.meta.company_id : undefined;
      return companyId ? `/contacts?company=${companyId}` : '/contacts';
    }
    case 'ingestion': {
      const runId = typeof event.meta?.run_id === 'string' ? event.meta.run_id : undefined;
      return runId ? `/activity?run=${runId}` : '/activity';
    }
    default:
      return '/activity';
  }
}
