# Data Model

The final local schema is the result of applying `migrations/0001_initial_schema.sql` followed by `migrations/0002_requirement_alignment.sql`. Migration 0001 is immutable. IDs are application-supplied text; timestamps use consistently formatted UTC ISO-8601 text so comparisons and retention indexes work. Event dates use `YYYY-MM-DD`.

The schema stores normalized interpretation, mechanical fingerprints, operational metadata, and provenance. It never stores raw Discord bodies, source document/page contents, attachment bytes, or individual voter identities. Text summaries, section notes, and error summaries are normalized facts or concise operational descriptions, not containers for raw input. There are no JSON or BLOB fields.

## Audit and reporting state

| Table                 | Purpose                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit_runs`          | Audit mode (`baseline`, `scheduled`, `on_demand`), outcome (`running`, `succeeded`, `partial`, `failed`), start/completion and optional window timestamps, optional authenticated `initiator_identity`, nonnegative message/source/report counts, and optional failure summary. |
| `audit_source_errors` | Relational failed/degraded-source details: run, optional source reference, source kind, optional channel ID/URL, error code, concise error summary, and occurrence time. Supports discovery/parser failures even before a source reference exists.                              |
| `audit_checkpoint`    | Named checkpoint value, update time, and optional run that advanced it.                                                                                                                                                                                                         |
| `audit_lock`          | Named exclusive holder with acquisition and expiry timestamps. Expiry must follow acquisition.                                                                                                                                                                                  |
| `reported_items`      | Unique `digest_key`, optional source reference, first/last report time, and positive report count for ordinary-item anti-duplication.                                                                                                                                           |

Running audits cannot have completion timestamps; terminal outcomes require them. Completed time cannot precede start. Run start-time, mode/outcome/completion, and source-error run indexes support history and health. Error rows cascade when a run is deleted; deleting a source clears its optional error reference. Checkpoint and lock references must be detached or removed before deleting their run.

The schema supports, but does not implement, successful-scheduled-only checkpoint advancement, expiring-lock acquisition, and authenticated on-demand initiation. Future application transactions enforce those rules. Retention can use indexed `audit_runs.started_at` (90 days), `reported_items.last_reported_at` (approximately one year), and resolved-question timestamps (30 days). No retention jobs exist.

## Discord observations

| Table                  | Purpose                                                                                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discord_categories`   | Category ID, current name, observation time, optional archival time.                                                                                                                                                  |
| `discord_channels`     | Channel ID, current name, optional category, semantic `channel_kind`, structural `structural_type`, optional `parent_channel_id`, observation time, and optional archival time.                                       |
| `message_observations` | Message/channel/author IDs, created/edited timestamps, nullable `content_hash`, Boolean pin and attachment state, last observation time, validity (`valid`, `missing`, `invalid`), optional invalidation time/reason. |

Semantic purpose (`performance`, `practice`, `question`, `poll`, `other`) is independent of Discord structure (`channel`, `forum`, `forum_post`, `thread`). A forum post or thread can reference its parent channel; category relationships and `archived_at` support monitoring exclusions and thread archival. This is a small observation model, not a full Discord mirror. Exactly one guild will be enforced by private deployment configuration and future retrieval code; there is no multi-guild product model.

Fingerprints permit mechanical edit detection without retaining bodies. A null fingerprint means the message has not yet been fingerprinted, particularly for migrated observations. Future observation code populates fingerprints and updates validity/pin state; the schema does not detect disappearance itself. Channel/observation-time and parent/category indexes support rescans and structure discovery.

## Source provenance and validity

`source_refs` supports `discord_message`, `discord_attachment`, `linked_url`, and `practice_sheet`. Every source has identity, kind, observation time, and validity (`valid`, `missing`, `invalid`, `inaccessible`). Nonvalid sources require an invalidation timestamp; valid sources cannot carry one. An optional reason records the normalized explanation.

Discord channel/message IDs are required for Discord kinds and otherwise optional as a pair, allowing a linked page to retain its originating Discord post. Optional durable context includes Discord message URL, author ID/display name, source timestamp, attachment ID/name/URL, and external URL. Attachments require an attachment ID; other kinds cannot carry attachment fields. Linked URLs and practice sheets require an external URL. Optional metadata may remain unknown for old records. Message and attachment partial unique indexes preserve source identity; external URLs are not globally unique because repeated observations of a changing sheet/page may have distinct provenance.

Source references deliberately do not depend on retained message observations. Facts can retain useful provenance after observation cleanup. Current fact rows carry `source_ref_id`; `performance_field_sources` permits multiple supporting sources for a scalar field. Source validity remains queryable through these relationships. A later audit must flag, clear, or replace unsupported facts and remove obsolete support edges when values change. There is no conflict engine or automatic invalidation cascade that deletes factual state.

## Current performance state

| Table                       | Purpose                                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `performances`              | One performance per Discord channel: current event `title`, optional `event_date`, venue, `call_at`, `performance_at`, active/retired state, seed provenance, and creation time.          |
| `performance_field_sources` | Many-to-many support edges for the finite scalar vocabulary `title`, `event_date`, `venue`, `call_at`, `performance_at`, `status`. Actual values stay in typed columns on `performances`. |
| `performance_performers`    | Confirmed performer name, optional Discord ID, and provenance, independent of assignments.                                                                                                |
| `performance_repertoire`    | Ordered song titles with optional section notes and source reference; sequence is positive and unique within a performance.                                                               |
| `performance_notes`         | Separate normalized equipment, logistics, and miscellaneous summaries, each with provenance.                                                                                              |
| `performance_assignments`   | Performer, optional song, instrument/color or non-playing responsibility, provenance, creation time, and optional originating performance plan.                                           |
| `performance_plans`         | Lightweight plan identity, owning performance, source, optional posting time, observation time, and current marker. No PDF bytes/content.                                                 |

Scalar provenance edges contain no generic values; this is a constrained support relation, not an EAV store. Seed `performances.source_ref_id` records original provenance while field edges track current authority. Repertoire, confirmations, notes, and assignments each retain their own source. There are no historical versions of the performance's fields.

A partial unique index permits at most one current performance plan per performance. Plan IDs and composite foreign keys ensure an assignment's plan belongs to the same performance. The plan index allows deletion of all plan-derived assignments as a unit. Deleting a plan also cascades its assignments. Supersession will be a future application transaction: delete old derived assignments, clear the old current marker, insert/mark the replacement plan, and replace normalized plan-derived facts and their source edges. Clearing a marker alone intentionally performs no workflow. Lightweight old plan metadata may remain.

Every assignment requires an instrument or responsibility. `beta_nagado`, `seated_nagado`, `naname_nagado`, and `shime` require color. `oodaiko`, `fue`, `chanchiki`, `tachi_okedo`, `yagura_oodaiko`, `chappa`, and `okedo` forbid color. Non-playing responsibilities work with null instrument/color. Assignment indexes cover performance and plan identity. Performance-owned child tables cascade on performance deletion.

## Practices

| Table               | Purpose                                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `practices`         | Scheduled timestamp, optional location/channel, planned/completed/cancelled state, sheet or Discord provenance, and creation time. Sheet-only practices need no Discord channel.  |
| `practice_plans`    | Plan identity, owning practice, source, optional posting time, observation time, and current marker; at most one current plan per practice.                                       |
| `practice_items`    | Ordered `song_title`, optional `section_notes`, source, and optional originating practice plan. Composite foreign key enforces plan ownership.                                    |
| `practice_absences` | Human name, optional Discord user ID, source, and creation time. Names identify absence rows within a practice; a partial unique index also prevents duplicate known Discord IDs. |

A current-plan query identifies the practice-plan association without a cyclic parent pointer. Absences represent explicit nonattendance only; there is no attendance roster or member-management subsystem. Identity matching, next-practice readiness, and past-practice cleanup remain future behavior. Practice children and associated questions cascade on practice deletion.

## Questions and polls

`questions` stores summary, `open`/`partially_resolved`/`resolved` state, Discord channel, provenance, creation time, original `asked_at`, most recent `last_activity_at`, optional partial-resolution summary, resolved time, and optional performance/practice relationships. Partial state requires its summary; only resolved state carries a resolved timestamp. Activity and resolution cannot precede the ask. Status/activity, resolution, and parent indexes support continuing questions and later retention. Retirement is later deletion behavior, not a fourth semantic state.

`polls` retains subject, channel, provenance, open/closed state, overall nonnegative `response_total`, creation and optional closure time. `poll_options` holds ordered option labels and nonnegative per-option vote counts, with unique ordering per poll and cascading deletion. No voter rows/identities exist. Overall response totals need not equal summed option votes because polls may allow multiple selections; consistency with source semantics is future application behavior.

## Forward migration and local workflow

Migration 0002 safely rebuilds constraint-changing tables using create/copy/drop/rename with deferred foreign-key checks, preserving identifiers and child references. It recreates affected indexes and uses additive columns or a column rename elsewhere. Legacy audit modes become baseline because 0001 did not record mode. Legacy answered/closed questions become resolved, retaining resolution time or falling back to creation time when unknown; ask/activity fields are seeded from available timestamps. Legacy absence names fall back to the existing Discord ID until re-observed. Item labels become song titles; legacy `scheduled_at` becomes `performance_at`. These are upgrade compatibility mappings, not newly inferred product facts.

Apply both migrations to Wrangler's persistent local state with `npm run d1:migrate:local`. Tests separately verify a fresh install and a populated, migration-ledger-tracked 0001 database upgraded through 0002; they check foreign-key integrity and representative retained rows. The `DB` binding and minimal `src/database.ts` boundary are unchanged. Remote D1 is not provisioned.
