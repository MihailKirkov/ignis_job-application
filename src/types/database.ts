// Hand-written Supabase Database types, kept in sync with
// supabase/migrations/0001_init.sql. (You can regenerate with the Supabase CLI
// `supabase gen types typescript` once linked, but this keeps the repo self-contained.)
//
// NOTE: these are `type` aliases (object literals), not `interface`s, on purpose —
// supabase-js constrains tables to `Record<string, unknown>`, which interfaces do
// not satisfy (no implicit index signature) but anonymous object types do.

export type ApplicationStatus =
  | 'To apply'
  | 'Applied'
  | 'Screening'
  | 'Interview'
  | 'Offer'
  | 'Rejected'
  | 'Closed';

export type WorkMode = 'On-site' | 'Hybrid' | 'Remote';

export type Channel =
  | 'Detachering'
  | 'Brainport portal'
  | 'LinkedIn'
  | 'Recruiter'
  | 'Direct'
  | 'Referral'
  | 'Other';

export type JobState = 'new' | 'saved' | 'dismissed' | 'promoted';

export type SourceType =
  | 'adzuna'
  | 'arbeitnow'
  | 'remotive'
  | 'remoteok'
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable';

export type JobRow = {
  id: string;
  user_id: string;
  source: string;
  external_id: string;
  title: string;
  company: string | null;
  location: string | null;
  mode: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  url: string | null;
  description: string | null;
  posted_at: string | null;
  raw: Record<string, unknown>;
  fuzzy_key: string | null;
  state: JobState;
  ingested_at: string;
  created_at: string;
  updated_at: string;
};

export type ApplicationRow = {
  id: string;
  user_id: string;
  job_id: string | null;
  company: string;
  role: string;
  location: string | null;
  mode: WorkMode | null;
  channel: Channel | null;
  status: ApplicationStatus;
  salary: string | null;
  link: string | null;
  contact: string | null;
  date_applied: string | null;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceRow = {
  id: string;
  user_id: string;
  type: SourceType;
  config: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SavedFilterRow = {
  id: string;
  user_id: string;
  name: string;
  criteria: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type Mutable<T> = Omit<T, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

// All writable columns are optional and may be null (DB constraints are the real
// guard; the app validates required fields before writing).
type Writable<Row> = { [K in keyof Mutable<Row>]?: Mutable<Row>[K] | null };

type TableShape<Row> = {
  Row: Row;
  Insert: Writable<Row> & { user_id: string };
  Update: Writable<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      jobs: TableShape<JobRow>;
      applications: TableShape<ApplicationRow>;
      sources: TableShape<SourceRow>;
      saved_filters: TableShape<SavedFilterRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
