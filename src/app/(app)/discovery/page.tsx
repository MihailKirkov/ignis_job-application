import { EmptyState } from '@/components/ui';

export default function DiscoveryPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-fg">Discovery</h1>
        <p className="text-sm text-muted">Ingested jobs from your enabled sources.</p>
      </header>
      <EmptyState
        title="Discovery inbox arrives in the next phase"
        hint="Ingestion (Adzuna, remote boards, and ATS company boards) is wired up after the tracker core is in place."
      />
    </div>
  );
}
