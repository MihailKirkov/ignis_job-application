import { APPLICATION_STATUSES } from '@/lib/constants';
import { statusColorToken } from '@/lib/utils';
import type { ApplicationStatus } from '@/types/database';
import { StatReadout } from './hud';

// Furthest-along stage that has entries — it glows as the "current" focus.
const GLOW_ORDER: ApplicationStatus[] = [
  'Offer',
  'Interview',
  'Screening',
  'Applied',
  'To apply',
];

// Tidy single-row pipeline stats: Active + every status, even grid, no orphans.
export function TrackerStats({
  counts,
  active,
}: {
  counts: Record<string, number>;
  active: number;
}) {
  const activeStage = GLOW_ORDER.find((s) => (counts[s] ?? 0) > 0) ?? null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      <StatReadout label="Active" value={active} colorToken="system" index="00" />
      {APPLICATION_STATUSES.map((s, i) => (
        <StatReadout
          key={s}
          label={s}
          value={counts[s] ?? 0}
          colorToken={statusColorToken(s)}
          active={s === activeStage}
          index={String(i + 1).padStart(2, '0')}
        />
      ))}
    </div>
  );
}
