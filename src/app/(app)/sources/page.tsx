import { EmptyState } from '@/components/ui';

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-fg">Sources</h1>
        <p className="text-sm text-muted">
          Configure which job feeds and company boards to ingest.
        </p>
      </header>
      <EmptyState
        title="Source configuration arrives in the next phase"
        hint="You'll add Adzuna queries and target-company ATS tokens (Greenhouse, Lever, Ashby, Workable) here."
      />
    </div>
  );
}
