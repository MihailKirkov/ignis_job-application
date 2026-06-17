import type { ApplicationStatus } from '@/types/database';
import { TERMINAL_STATUSES } from './constants';
import type { Vitals } from '@/components/needs-action-view';

// Statuses that mean an application was actually sent vs. got a reply.
export const SENT_STATUSES: ApplicationStatus[] = [
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Rejected',
];
export const REPLIED_STATUSES: ApplicationStatus[] = [
  'Screening',
  'Interview',
  'Offer',
  'Rejected',
];

// Pure vitals for the command bridge, computed from the flat list of statuses.
export function computeVitals(statuses: ApplicationStatus[]): Vitals {
  const countOf = (s: ApplicationStatus) => statuses.filter((x) => x === s).length;
  const active = statuses.filter((s) => !TERMINAL_STATUSES.includes(s)).length;
  const sent = statuses.filter((s) => SENT_STATUSES.includes(s)).length;
  const replied = statuses.filter((s) => REPLIED_STATUSES.includes(s)).length;
  return {
    active,
    applied: countOf('Applied'),
    interview: countOf('Interview'),
    offer: countOf('Offer'),
    sent,
    replied,
    responseRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
  };
}
