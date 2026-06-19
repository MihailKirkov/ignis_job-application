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

// AI fit-score verdict (also drives the discovery badge colour).
export type ScoreVerdict = 'strong' | 'medium' | 'weak';

export type Seniority =
  | 'intern'
  | 'junior'
  | 'medior'
  | 'senior'
  | 'lead'
  | 'principal';

// A single profile link, stored in the profiles.links jsonb array.
export type ProfileLink = { label: string; url: string };

// Activity log + ingestion log -------------------------------------------------

export type ActivityCategory = 'application' | 'job' | 'profile' | 'source' | 'ingestion';

// Append-only event vocabulary. The category is derivable from the type prefix.
export type ActivityType =
  | 'application.created'
  | 'application.status_changed'
  | 'application.deleted'
  | 'job.promoted'
  | 'job.saved'
  | 'job.dismissed'
  | 'profile.updated'
  | 'source.added'
  | 'source.removed'
  | 'source.toggled'
  | 'ingestion.completed';

export type IngestionTrigger = 'manual_all' | 'manual_source' | 'cron';
export type RunStatus = 'ok' | 'partial' | 'error';
export type RunSourceStatus = 'ok' | 'error' | 'skipped';

// Async AI fit-scoring runs (see 0005_scoring_runs.sql).
export type ScoringTrigger = 'manual' | 'cron';
export type ScoringRunStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export type SourceType =
  | 'adzuna'
  | 'arbeitnow'
  | 'remotive'
  | 'remoteok'
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'recruitee'
  | 'smartrecruiters';

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
  // AI fit score against the user's profile (null until scored).
  fit_score: number | null;
  fit_verdict: ScoreVerdict | null;
  fit_summary: string | null;
  fit_breakdown: Record<string, unknown>; // { matched_skills: string[], gaps: string[] }
  scored_at: string | null;
  scored_profile_hash: string | null;
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

// profiles is one row per user, keyed directly by user_id (no separate id).
export type ProfileRow = {
  user_id: string;
  full_name: string | null;
  headline: string | null;
  location: string | null;
  summary: string | null;
  seniority: Seniority | null;
  skills: string[];
  target_roles: string[];
  target_locations: string[];
  target_salary_min: number | null;
  work_modes: WorkMode[];
  languages: string[];
  links: ProfileLink[];
  cv_text: string | null;
  cv_file_path: string | null;
  created_at: string;
  updated_at: string;
};

// activity_events is an append-only feed; entity_id has NO FK (log outlives the
// entity). meta is event-shaped (see buildActivitySummary).
export type ActivityEventRow = {
  id: string;
  user_id: string;
  type: ActivityType;
  category: ActivityCategory;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type IngestionRunRow = {
  id: string;
  user_id: string;
  trigger: IngestionTrigger;
  status: RunStatus;
  sources_run: number;
  jobs_fetched: number;
  jobs_new: number;
  jobs_updated: number;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  created_at: string;
};

export type IngestionRunSourceRow = {
  id: string;
  run_id: string;
  user_id: string;
  source_id: string | null;
  source_type: string;
  source_label: string | null;
  status: RunSourceStatus;
  http_status: number | null;
  jobs_fetched: number;
  jobs_new: number;
  jobs_updated: number;
  duration_ms: number | null;
  message: string | null;
  created_at: string;
};

export type ScoringRunRow = {
  id: string;
  user_id: string;
  trigger: ScoringTrigger;
  status: ScoringRunStatus;
  total: number;
  completed: number;
  failed: number;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  created_at: string;
};

// user_secrets is one row per user; anthropic_api_key is stored ENCRYPTED.
export type UserSecretRow = {
  user_id: string;
  anthropic_api_key: string | null;
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
      profiles: TableShape<ProfileRow>;
      user_secrets: TableShape<UserSecretRow>;
      activity_events: TableShape<ActivityEventRow>;
      ingestion_runs: TableShape<IngestionRunRow>;
      ingestion_run_sources: TableShape<IngestionRunSourceRow>;
      scoring_runs: TableShape<ScoringRunRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
