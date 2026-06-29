-- =============================================================================
-- Channel attribution indexes.
--
-- Phase 3 reads applications + outreach grouped by channel to build the
-- "pipeline by channel" funnel (which methods convert). These composite indexes
-- back that aggregation. No new columns — applications.channel and
-- outreach.channel already carry the attribution.
-- =============================================================================

create index applications_user_channel_status_idx
  on public.applications (user_id, channel, status);

create index outreach_user_channel_status_idx
  on public.outreach (user_id, channel, status);
