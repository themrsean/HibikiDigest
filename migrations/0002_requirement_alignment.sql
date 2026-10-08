-- Forward-only alignment; 0001 remains immutable.
-- D1 runs migrations transactionally. Defer references during parent rebuilds;
-- create/copy/drop/rename avoids rewriting child foreign-key targets.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE audit_runs_new (
  audit_run_id TEXT PRIMARY KEY,
  audit_mode TEXT NOT NULL CHECK (audit_mode IN ('baseline', 'scheduled', 'on_demand')),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  initiator_identity TEXT,
  window_started_at TEXT,
  window_ended_at TEXT,
  messages_observed INTEGER NOT NULL DEFAULT 0 CHECK (messages_observed >= 0),
  sources_processed INTEGER NOT NULL DEFAULT 0 CHECK (sources_processed >= 0),
  items_reported INTEGER NOT NULL DEFAULT 0 CHECK (items_reported >= 0),
  failure_summary TEXT,
  CHECK ((status = 'running' AND completed_at IS NULL)
    OR (status <> 'running' AND completed_at IS NOT NULL)),
  CHECK (completed_at IS NULL OR completed_at >= started_at),
  CHECK (window_started_at IS NULL OR window_ended_at IS NULL OR window_ended_at >= window_started_at)
);

INSERT INTO audit_runs_new (audit_run_id, audit_mode, status, started_at, completed_at, failure_summary)
SELECT audit_run_id, 'baseline', status, started_at, completed_at, failure_summary FROM audit_runs;
DROP TABLE audit_runs;
ALTER TABLE audit_runs_new RENAME TO audit_runs;

CREATE INDEX audit_runs_started_at_idx ON audit_runs(started_at);
CREATE INDEX audit_runs_mode_status_completed_idx ON audit_runs(audit_mode, status, completed_at);

ALTER TABLE discord_channels ADD COLUMN structural_type TEXT NOT NULL DEFAULT 'channel'
  CHECK (structural_type IN ('channel', 'forum', 'forum_post', 'thread'));
ALTER TABLE discord_channels ADD COLUMN parent_channel_id TEXT REFERENCES discord_channels(discord_channel_id);
CREATE INDEX discord_channels_parent_idx ON discord_channels(parent_channel_id);

-- Legacy bodies cannot be hashed retroactively. NULL means not fingerprinted yet.
ALTER TABLE message_observations ADD COLUMN content_hash TEXT;
ALTER TABLE message_observations ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1));
ALTER TABLE message_observations ADD COLUMN validity TEXT NOT NULL DEFAULT 'valid' CHECK (validity IN ('valid', 'missing', 'invalid'));
ALTER TABLE message_observations ADD COLUMN invalidated_at TEXT;
ALTER TABLE message_observations ADD COLUMN invalidation_reason TEXT;

CREATE TABLE source_refs_new (
  source_ref_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('discord_message', 'discord_attachment', 'linked_url', 'practice_sheet')),
  discord_channel_id TEXT REFERENCES discord_channels(discord_channel_id),
  discord_message_id TEXT,
  discord_message_url TEXT,
  author_discord_user_id TEXT,
  author_display_name TEXT,
  source_timestamp TEXT,
  discord_attachment_id TEXT,
  attachment_name TEXT,
  attachment_url TEXT,
  external_url TEXT,
  observed_at TEXT NOT NULL,
  validity TEXT NOT NULL DEFAULT 'valid' CHECK (validity IN ('valid', 'missing', 'invalid', 'inaccessible')),
  invalidated_at TEXT,
  invalidation_reason TEXT,
  CHECK ((discord_channel_id IS NULL AND discord_message_id IS NULL)
    OR (discord_channel_id IS NOT NULL AND discord_message_id IS NOT NULL)),
  CHECK (source_kind NOT IN ('discord_message', 'discord_attachment')
    OR (discord_channel_id IS NOT NULL AND discord_message_id IS NOT NULL)),
  CHECK ((source_kind = 'discord_attachment' AND discord_attachment_id IS NOT NULL)
    OR (source_kind <> 'discord_attachment' AND discord_attachment_id IS NULL AND attachment_name IS NULL AND attachment_url IS NULL)),
  CHECK (source_kind NOT IN ('linked_url', 'practice_sheet') OR external_url IS NOT NULL),
  CHECK (discord_message_url IS NULL OR discord_message_id IS NOT NULL),
  CHECK ((validity = 'valid' AND invalidated_at IS NULL)
    OR (validity <> 'valid' AND invalidated_at IS NOT NULL))
);

INSERT INTO source_refs_new (source_ref_id, source_kind, discord_channel_id, discord_message_id, discord_attachment_id, observed_at)
SELECT source_ref_id, source_kind, discord_channel_id, discord_message_id, discord_attachment_id, observed_at FROM source_refs;
DROP TABLE source_refs;
ALTER TABLE source_refs_new RENAME TO source_refs;

CREATE UNIQUE INDEX source_refs_discord_message_unique ON source_refs(discord_message_id) WHERE source_kind = 'discord_message';
CREATE UNIQUE INDEX source_refs_discord_attachment_unique ON source_refs(discord_message_id, discord_attachment_id) WHERE source_kind = 'discord_attachment';
CREATE INDEX source_refs_validity_idx ON source_refs(validity);

CREATE TABLE audit_source_errors (
  audit_source_error_id TEXT PRIMARY KEY,
  audit_run_id TEXT NOT NULL REFERENCES audit_runs(audit_run_id) ON DELETE CASCADE,
  source_ref_id TEXT REFERENCES source_refs(source_ref_id) ON DELETE SET NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('discord_message', 'discord_attachment', 'linked_url', 'practice_sheet', 'discord_channel', 'd1')),
  discord_channel_id TEXT,
  source_url TEXT,
  error_code TEXT NOT NULL,
  error_summary TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
CREATE INDEX audit_source_errors_run_idx ON audit_source_errors(audit_run_id);

ALTER TABLE performances ADD COLUMN event_date TEXT;
ALTER TABLE performances ADD COLUMN venue TEXT;
ALTER TABLE performances ADD COLUMN call_at TEXT;
-- Preserve legacy schedule values in the explicit current performance-time field.
ALTER TABLE performances RENAME COLUMN scheduled_at TO performance_at;

CREATE TABLE practices_new (
  practice_id TEXT PRIMARY KEY,
  discord_channel_id TEXT REFERENCES discord_channels(discord_channel_id),
  scheduled_at TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL CHECK (status IN ('planned', 'completed', 'cancelled')),
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  created_at TEXT NOT NULL
);

INSERT INTO practices_new (practice_id, discord_channel_id, scheduled_at, status, source_ref_id, created_at)
SELECT practice_id, discord_channel_id, scheduled_at, status, source_ref_id, created_at FROM practices;
DROP TABLE practices;
ALTER TABLE practices_new RENAME TO practices;

CREATE INDEX practices_scheduled_at_idx ON practices(scheduled_at);

CREATE TABLE performance_plans (
  performance_plan_id TEXT PRIMARY KEY,
  performance_id TEXT NOT NULL REFERENCES performances(performance_id) ON DELETE CASCADE,
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  posted_at TEXT,
  observed_at TEXT NOT NULL,
  is_current INTEGER NOT NULL CHECK (is_current IN (0, 1)),
  UNIQUE (performance_plan_id, performance_id)
);
CREATE UNIQUE INDEX performance_plans_current_unique ON performance_plans(performance_id) WHERE is_current = 1;

CREATE TABLE practice_plans (
  practice_plan_id TEXT PRIMARY KEY,
  practice_id TEXT NOT NULL REFERENCES practices(practice_id) ON DELETE CASCADE,
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  posted_at TEXT,
  observed_at TEXT NOT NULL,
  is_current INTEGER NOT NULL CHECK (is_current IN (0, 1)),
  UNIQUE (practice_plan_id, practice_id)
);
CREATE UNIQUE INDEX practice_plans_current_unique ON practice_plans(practice_id) WHERE is_current = 1;

CREATE TABLE performance_assignments_new (
  assignment_id TEXT PRIMARY KEY,
  performance_id TEXT NOT NULL REFERENCES performances(performance_id) ON DELETE CASCADE,
  performer_name TEXT NOT NULL,
  song_title TEXT,
  instrument TEXT CHECK (
    instrument IS NULL OR instrument IN (
      'beta_nagado', 'seated_nagado', 'naname_nagado', 'shime', 'oodaiko',
      'fue', 'chanchiki', 'tachi_okedo', 'yagura_oodaiko', 'chappa', 'okedo'
    )
  ),
  instrument_color TEXT,
  responsibility TEXT,
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  created_at TEXT NOT NULL,
  performance_plan_id TEXT,
  CHECK (instrument IS NOT NULL OR responsibility IS NOT NULL),
  CHECK (
    (instrument IN ('beta_nagado', 'seated_nagado', 'naname_nagado', 'shime')
      AND instrument_color IS NOT NULL)
    OR (instrument NOT IN ('beta_nagado', 'seated_nagado', 'naname_nagado', 'shime')
      AND instrument_color IS NULL)
    OR (instrument IS NULL AND instrument_color IS NULL)
  ),
  FOREIGN KEY (performance_plan_id, performance_id) REFERENCES performance_plans(performance_plan_id, performance_id) ON DELETE CASCADE
);

INSERT INTO performance_assignments_new (assignment_id, performance_id, performer_name, song_title, instrument, instrument_color, responsibility, source_ref_id, created_at)
SELECT assignment_id, performance_id, performer_name, song_title, instrument, instrument_color, responsibility, source_ref_id, created_at FROM performance_assignments;
DROP TABLE performance_assignments;
ALTER TABLE performance_assignments_new RENAME TO performance_assignments;

CREATE INDEX performance_assignments_performance_idx ON performance_assignments(performance_id);
CREATE INDEX performance_assignments_plan_idx ON performance_assignments(performance_plan_id);

CREATE TABLE practice_items_new (
  practice_item_id TEXT PRIMARY KEY,
  practice_id TEXT NOT NULL REFERENCES practices(practice_id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  song_title TEXT NOT NULL,
  section_notes TEXT,
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  practice_plan_id TEXT,
  UNIQUE (practice_id, sequence_number),
  FOREIGN KEY (practice_plan_id, practice_id) REFERENCES practice_plans(practice_plan_id, practice_id) ON DELETE CASCADE
);

INSERT INTO practice_items_new (practice_item_id, practice_id, sequence_number, song_title, source_ref_id)
SELECT practice_item_id, practice_id, sequence_number, item_label, source_ref_id FROM practice_items;
DROP TABLE practice_items;
ALTER TABLE practice_items_new RENAME TO practice_items;

CREATE INDEX practice_items_plan_idx ON practice_items(practice_plan_id);

CREATE TABLE practice_absences_new (
  practice_id TEXT NOT NULL REFERENCES practices(practice_id) ON DELETE CASCADE,
  member_name TEXT NOT NULL CHECK (length(trim(member_name)) > 0),
  member_discord_user_id TEXT,
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (practice_id, member_name)
);

INSERT INTO practice_absences_new (practice_id, member_name, member_discord_user_id, source_ref_id, created_at)
SELECT practice_id, member_discord_user_id, member_discord_user_id, source_ref_id, created_at FROM practice_absences;
DROP TABLE practice_absences;
ALTER TABLE practice_absences_new RENAME TO practice_absences;

CREATE UNIQUE INDEX practice_absences_discord_user_unique ON practice_absences(practice_id, member_discord_user_id) WHERE member_discord_user_id IS NOT NULL;

CREATE TABLE questions_new (
  question_id TEXT PRIMARY KEY,
  discord_channel_id TEXT NOT NULL REFERENCES discord_channels(discord_channel_id),
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'partially_resolved', 'resolved')),
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  created_at TEXT NOT NULL,
  asked_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  partial_resolution_summary TEXT,
  resolved_at TEXT,
  performance_id TEXT REFERENCES performances(performance_id) ON DELETE CASCADE,
  practice_id TEXT REFERENCES practices(practice_id) ON DELETE CASCADE,
  CHECK (last_activity_at >= asked_at),
  CHECK (status <> 'partially_resolved' OR partial_resolution_summary IS NOT NULL),
  CHECK ((status = 'resolved' AND resolved_at IS NOT NULL AND resolved_at >= asked_at)
    OR (status <> 'resolved' AND resolved_at IS NULL))
);

INSERT INTO questions_new (question_id, discord_channel_id, summary, status, source_ref_id, created_at, asked_at, last_activity_at, resolved_at)
SELECT question_id, discord_channel_id, summary, CASE WHEN status = 'open' THEN 'open' ELSE 'resolved' END, source_ref_id, created_at, created_at, COALESCE(resolved_at, created_at), CASE WHEN status = 'open' THEN NULL ELSE COALESCE(resolved_at, created_at) END FROM questions;
DROP TABLE questions;
ALTER TABLE questions_new RENAME TO questions;

CREATE INDEX questions_status_activity_idx ON questions(status, last_activity_at);
CREATE INDEX questions_resolved_at_idx ON questions(resolved_at) WHERE status = 'resolved';
CREATE INDEX questions_performance_idx ON questions(performance_id);
CREATE INDEX questions_practice_idx ON questions(practice_id);
CREATE INDEX reported_items_last_reported_at_idx ON reported_items(last_reported_at);

CREATE TABLE poll_options (
  poll_option_id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES polls(poll_id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  label TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
  UNIQUE (poll_id, sequence_number)
);

-- Finite field vocabulary: values stay in typed performance columns, never EAV.
CREATE TABLE performance_field_sources (
  performance_id TEXT NOT NULL REFERENCES performances(performance_id) ON DELETE CASCADE,
  field_name TEXT NOT NULL CHECK (field_name IN ('title', 'event_date', 'venue', 'call_at', 'performance_at', 'status')),
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  PRIMARY KEY (performance_id, field_name, source_ref_id)
);
INSERT INTO performance_field_sources (performance_id, field_name, source_ref_id)
SELECT performance_id, 'title', source_ref_id FROM performances;
INSERT INTO performance_field_sources (performance_id, field_name, source_ref_id)
SELECT performance_id, 'performance_at', source_ref_id FROM performances WHERE performance_at IS NOT NULL;
CREATE INDEX performance_field_sources_source_idx ON performance_field_sources(source_ref_id);

CREATE TABLE performance_performers (
  performance_id TEXT NOT NULL REFERENCES performances(performance_id) ON DELETE CASCADE,
  performer_name TEXT NOT NULL,
  performer_discord_user_id TEXT,
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  PRIMARY KEY (performance_id, performer_name)
);

CREATE TABLE performance_repertoire (
  repertoire_item_id TEXT PRIMARY KEY,
  performance_id TEXT NOT NULL REFERENCES performances(performance_id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  song_title TEXT NOT NULL,
  section_notes TEXT,
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  UNIQUE (performance_id, sequence_number)
);

CREATE TABLE performance_notes (
  performance_note_id TEXT PRIMARY KEY,
  performance_id TEXT NOT NULL REFERENCES performances(performance_id) ON DELETE CASCADE,
  note_kind TEXT NOT NULL CHECK (note_kind IN ('equipment', 'logistics', 'misc')),
  summary TEXT NOT NULL,
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id)
);
CREATE INDEX performance_notes_performance_idx ON performance_notes(performance_id);

PRAGMA defer_foreign_keys = OFF;
