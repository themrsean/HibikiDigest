# Data Model

The initial normalized D1 schema is in `migrations/0001_initial_schema.sql`. IDs are application-supplied text identifiers; timestamps are UTC ISO-8601 text. The schema stores normalized interpretation and traceability, never raw Discord message bodies, attachment bytes, or document contents.

## Audit and operational state

| Table              | Purpose and key columns                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit_runs`       | One attempted audit. `audit_run_id` is the primary key; `status`, start/completion timestamps, and an optional failure summary describe its outcome. |
| `audit_checkpoint` | Named, durable audit cursors. `checkpoint_name` is the primary key and may refer to the run that advanced it.                                        |
| `audit_lock`       | A named, expiring lock held by an audit run. `lock_name` is unique, preventing concurrent holders for the same scope.                                |
| `reported_items`   | Anti-duplication state for digest output. A unique `digest_key` tracks first/last report timestamps and count, with an optional `source_ref_id`.     |

## Discord observations and traceability

| Table                  | Purpose and key columns                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discord_categories`   | Current observed category identity and name, keyed by Discord category ID. `archived_at` reserves state for later retirement processing.                                                                                                                                                                                                             |
| `discord_channels`     | Current observed channel identity, category relationship, kind, and archival marker, keyed by Discord channel ID.                                                                                                                                                                                                                                    |
| `message_observations` | Mechanical message metadata keyed by Discord message ID: channel, author ID, message timestamps, attachment presence, and observation time. There is deliberately no message-body column.                                                                                                                                                            |
| `source_refs`          | Durable Discord message or attachment references used by normalized records. It stores channel/message/attachment identifiers and observation time only. A check distinguishes a message reference from an attachment reference; partial unique indexes prevent duplicate references. No source text, content bytes, or attachment data is retained. |

`discord_channels` belongs optionally to `discord_categories`. `message_observations` and `source_refs` belong to `discord_channels`. Source references preserve provenance without retaining source material.

## Performance state

| Table                     | Purpose and key columns                                                                                                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `performances`            | A performance linked one-to-one with its Discord channel. It has title, optional schedule, active/retired state, creation time, and source reference.                                                                                                                |
| `performance_assignments` | A performer’s song-specific playing assignment or non-playing responsibility. It links to a performance and source reference and records `performer_name`, optional `song_title`, optional `instrument`, optional `instrument_color`, and optional `responsibility`. |

Every assignment requires an instrument or responsibility. Instrument values are constrained to the agreed instrument set. `beta_nagado`, `seated_nagado`, `naname_nagado`, and `shime` require a color; other instruments and non-playing responsibilities cannot carry one. The `performance_assignments_performance_idx` supports later performance views.

## Practice state

| Table               | Purpose and key columns                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `practices`         | A scheduled practice, its channel, planned/completed/cancelled status, provenance, and creation time.                                                                     |
| `practice_items`    | Ordered normalized agenda or repertoire items. `(practice_id, sequence_number)` is unique.                                                                                |
| `practice_absences` | Explicit absences only, keyed by `(practice_id, member_discord_user_id)`, with provenance. No attendance boolean is stored; members without a row are presumed available. |

## Questions and polls

| Table       | Purpose and key columns                                                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `questions` | A normalized question summary with open/answered/closed state, channel, provenance, and resolution timestamp. The summary is the persisted interpretation, not a raw message body. |
| `polls`     | A normalized poll subject with open/closed state, aggregate `response_total`, channel, and provenance. There are no voter identities or vote rows.                                 |

## Local workflow

`wrangler.jsonc` defines the `DB` D1 binding and `migrations/` directory for local use. Apply migrations to Wrangler’s persistent local state with:

```sh
npm run d1:migrate:local
```

The migration test creates a separate temporary local D1 state directory and applies the same migration, so it does not depend on an existing local database.
