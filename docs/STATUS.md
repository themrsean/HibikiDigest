# Project Status

- Current phase: Phase 1, Slice 1A.2 — **complete** local D1 requirement alignment through forward migration `0002_requirement_alignment.sql`. Committed migration 0001 remains unchanged.
- Phase 0: **complete**. Phase 0B remote ChatGPT connectivity and Phase 0C visual transport were manually verified: readiness returned the expected static result; image interpretation was `NAMI`, PDF interpretation was `MORI; green`.
- Public Worker: `https://hibiki-digest-phase0b.themrsean.workers.dev`; MCP endpoint: `https://hibiki-digest-phase0b.themrsean.workers.dev/mcp`.
- The deployed endpoint still exposes exactly `phase0_probe`, `phase0_image_probe`, and `phase0_pdf_probe`. Slice 1A.2 changes no Worker code, public tools, database boundary, or Wrangler configuration. No deployment was performed.
- Validated initial production transport remains direct MCP images and embedded binary `application/pdf` resources. Raw source content stays transient.
- Local D1: both migrations apply successfully to a fresh isolated database. A separately populated, migration-ledger-tracked 0001 database upgrades through 0002 with foreign-key integrity and existing identifiers/relationships preserved. The persistent local Wrangler database also applied 0002 successfully.
- Remote D1 is still **NOT provisioned**. No remote database ID or private deployment configuration was added.
- [REQUIREMENTS.md](REQUIREMENTS.md) is authoritative; [DATA_MODEL.md](DATA_MODEL.md) describes the final 23-table local schema and upgrade compatibility mappings.
- Next intended step: explicitly scoped remote D1 provisioning and schema/binding verification before Discord or Google Sheets source integrations.

## Slice 1A.2 implementation

- Rebuilt `audit_runs`, `source_refs`, `practices`, `performance_assignments`, `practice_items`, `practice_absences`, and `questions` with create/copy/drop/rename and deferred foreign-key checks.
- Altered `discord_channels` for structural type/parent, `message_observations` for fingerprint/pin/validity, and `performances` for event date/venue/call time and explicit performance time (renamed legacy schedule). Added a reported-item retention index.
- Added `audit_source_errors`, `poll_options`, `performance_plans`, `practice_plans`, `performance_field_sources`, `performance_performers`, `performance_repertoire`, and `performance_notes`.
- Resolved the prior schema gaps: audit modes/partial outcomes/counts/initiators/errors; mechanical edits/pins/disappearance metadata; thread/forum structure; external/sheet provenance and source validity; semantic questions and related entities; aggregate poll options; sheet-only practices, human-name absences, song/section items; explicit current plans and plan attribution; current performance fields, confirmations, ordered repertoire, logistics/notes, and finite field/source support edges; indexed retention timestamps.
- Important constraints: explicit mode/status/kind vocabularies; completion/resolution timestamp consistency; source-kind applicability and invalidation state; nonnegative counts; positive unique ordering; one current plan per owner; composite plan ownership foreign keys; unchanged instrument/color rules; no individual-vote or raw-content storage.
- Legacy mappings are documented: missing audit mode becomes baseline, answered/closed questions become resolved with available/fallback timestamps, absent human names fall back to known Discord IDs, unobserved hashes remain null, and old item labels/schedules retain their values under explicit song/performance-time fields.

## Validation and TDD

- Pre-change `npm run check`: passed, 3 test files and 9 tests plus type checking, lint, and formatting.
- Test-first requirement coverage was added before migration changes. The red run against 0001 had 12 failing and 3 passing tests: 11 schema/migration failures (missing tables/columns/constraints and absent migration 0002), plus one D1-rejected privacy-introspection query that was corrected to supported PRAGMAs. A sandbox-only failure was rerun with local Wrangler permissions; it was not counted as a product red result.
- Migration implementation then passed the focused suite. Verification was strengthened to use Wrangler's actual migration ledger, preserve representative rows from every rebuilt table, check plan ownership/cascades and retention indexes, and inspect all product-table columns through supported D1 PRAGMAs. D1 protects internal metadata and blocks table-valued PRAGMA access, so privacy inspection excludes its internal tables.
- Final focused D1 schema/migration tests: passed, 16 tests.
- `npm run d1:migrate:local`: passed; applied migration 0002 to existing local state, 73 commands.
- `npm test`: passed, 3 test files and 20 tests.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run check`: passed.
- `npm run deploy -- --dry-run`: passed; exited without deployment.
- `npm audit --omit=dev`: exited 1 with **3 high-severity vulnerability findings**, involving the same MCP OAuth advisory across `@modelcontextprotocol/client`, `@modelcontextprotocol/sdk`, and `agents`. Automated remediation proposes a breaking `agents` change; dependencies were unchanged in this slice.

## Remaining future behavior

There are no intentionally deferred schema requirements from Slice 1A.2. These remaining requirements need application/deployment work, not more schema scaffolding:

- Provision and verify remote D1. Configure exactly one guild, then implement authenticated source retrieval and approved-user enforcement.
- Enforce single-audit locking, on-demand initiator capture, and successful-scheduled-only checkpoint advancement through transactions.
- Compute fingerprints, observe pins/edits/structure, detect missing/inaccessible sources, and populate source context. Legacy metadata cannot be reconstructed without re-observation.
- Interpret contradictions and replace unsupported facts/source edges; complete performance-plan supersession must atomically replace all old derived assignments and facts. Merely marking a plan noncurrent does not remove its rows.
- Implement semantic question resolution/retirement, poll updates, absence-name matching, next-practice readiness, past-practice cleanup, and archived-performance cleanup.
- Implement retention jobs: approximately one year for ordinary reported items, 90 days for audit metadata, 30 days for resolved questions. Detach checkpoint references and remove locks before deleting their runs; remove source-dependent facts/references in the intended lifecycle order. Schema cascades support owned-child cleanup but do not schedule deletion.
- Address the existing dependency advisories in a separately scoped dependency change.
