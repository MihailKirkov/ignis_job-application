import { Badge } from './ui';
import { statusColorToken } from '@/lib/utils';
import type { ApplicationStatus } from '@/types/database';

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge colorToken={statusColorToken(status)}>{status}</Badge>;
}
