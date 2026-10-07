CREATE TABLE audit_runs (
  audit_run_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  failure_summary TEXT,
  CHECK (
    (status = 'running' AND completed_at IS NULL)
    OR (status IN ('succeeded', 'failed') AND completed_at IS NOT NULL)
  )
);

CREATE TABLE audit_checkpoint (
  checkpoint_name TEXT PRIMARY KEY,
  audit_run_id TEXT REFERENCES audit_runs(audit_run_id),
  checkpoint_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_lock (
  lock_name TEXT PRIMARY KEY,
  holder_audit_run_id TEXT NOT NULL REFERENCES audit_runs(audit_run_id),
  acquired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  CHECK (expires_at > acquired_at)
);

CREATE TABLE discord_categories (
  discord_category_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE discord_channels (
  discord_channel_id TEXT PRIMARY KEY,
  discord_category_id TEXT REFERENCES discord_categories(discord_category_id),
  name TEXT NOT NULL,
  channel_kind TEXT NOT NULL CHECK (
    channel_kind IN ('performance', 'practice', 'question', 'poll', 'other')
  ),
  observed_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX discord_channels_category_idx
  ON discord_channels(discord_category_id);

CREATE TABLE message_observations (
  discord_message_id TEXT PRIMARY KEY,
  discord_channel_id TEXT NOT NULL REFERENCES discord_channels(discord_channel_id),
  author_discord_user_id TEXT,
  message_created_at TEXT NOT NULL,
  message_edited_at TEXT,
  has_attachments INTEGER NOT NULL DEFAULT 0 CHECK (has_attachments IN (0, 1)),
  observed_at TEXT NOT NULL
);

CREATE INDEX message_observations_channel_observed_at_idx
  ON message_observations(discord_channel_id, observed_at);

CREATE TABLE source_refs (
  source_ref_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL CHECK (
    source_kind IN ('discord_message', 'discord_attachment')
  ),
  discord_channel_id TEXT NOT NULL REFERENCES discord_channels(discord_channel_id),
  discord_message_id TEXT NOT NULL,
  discord_attachment_id TEXT,
  observed_at TEXT NOT NULL,
  CHECK (
    (source_kind = 'discord_message' AND discord_attachment_id IS NULL)
    OR (source_kind = 'discord_attachment' AND discord_attachment_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX source_refs_discord_message_unique
  ON source_refs(discord_message_id)
  WHERE source_kind = 'discord_message';

CREATE UNIQUE INDEX source_refs_discord_attachment_unique
  ON source_refs(discord_message_id, discord_attachment_id)
  WHERE source_kind = 'discord_attachment';

CREATE TABLE reported_items (
  reported_item_id TEXT PRIMARY KEY,
  digest_key TEXT NOT NULL,
  source_ref_id TEXT REFERENCES source_refs(source_ref_id),
  first_reported_at TEXT NOT NULL,
  last_reported_at TEXT NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 1 CHECK (report_count > 0),
  CHECK (last_reported_at >= first_reported_at)
);

CREATE UNIQUE INDEX reported_items_digest_key_unique
  ON reported_items(digest_key);

CREATE TABLE performances (
  performance_id TEXT PRIMARY KEY,
  discord_channel_id TEXT NOT NULL UNIQUE REFERENCES discord_channels(discord_channel_id),
  title TEXT NOT NULL,
  scheduled_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'retired')),
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  created_at TEXT NOT NULL
);

CREATE INDEX performances_status_scheduled_at_idx
  ON performances(status, scheduled_at);

CREATE TABLE performance_assignments (
  assignment_id TEXT PRIMARY KEY,
  performance_id TEXT NOT NULL REFERENCES performances(performance_id),
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
  CHECK (instrument IS NOT NULL OR responsibility IS NOT NULL),
  CHECK (
    (instrument IN ('beta_nagado', 'seated_nagado', 'naname_nagado', 'shime')
      AND instrument_color IS NOT NULL)
    OR (instrument NOT IN ('beta_nagado', 'seated_nagado', 'naname_nagado', 'shime')
      AND instrument_color IS NULL)
    OR (instrument IS NULL AND instrument_color IS NULL)
  )
);

CREATE INDEX performance_assignments_performance_idx
  ON performance_assignments(performance_id);

CREATE TABLE practices (
  practice_id TEXT PRIMARY KEY,
  discord_channel_id TEXT NOT NULL REFERENCES discord_channels(discord_channel_id),
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'completed', 'cancelled')),
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  created_at TEXT NOT NULL
);

CREATE INDEX practices_scheduled_at_idx ON practices(scheduled_at);

CREATE TABLE practice_items (
  practice_item_id TEXT PRIMARY KEY,
  practice_id TEXT NOT NULL REFERENCES practices(practice_id),
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  item_label TEXT NOT NULL,
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  UNIQUE(practice_id, sequence_number)
);

CREATE TABLE practice_absences (
  practice_id TEXT NOT NULL REFERENCES practices(practice_id),
  member_discord_user_id TEXT NOT NULL,
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (practice_id, member_discord_user_id)
);

CREATE TABLE questions (
  question_id TEXT PRIMARY KEY,
  discord_channel_id TEXT NOT NULL REFERENCES discord_channels(discord_channel_id),
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'answered', 'closed')),
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX questions_status_created_at_idx ON questions(status, created_at);

CREATE TABLE polls (
  poll_id TEXT PRIMARY KEY,
  discord_channel_id TEXT NOT NULL REFERENCES discord_channels(discord_channel_id),
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  response_total INTEGER NOT NULL DEFAULT 0 CHECK (response_total >= 0),
  source_ref_id TEXT NOT NULL REFERENCES source_refs(source_ref_id),
  created_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE INDEX polls_status_created_at_idx ON polls(status, created_at);
