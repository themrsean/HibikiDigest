# Project Status

- Current phase: Phase 1, Slice 1B — **complete**. Remote D1 is provisioned, both migrations are applied, schema is verified, and the Worker is deployed with its D1 binding. Production MCP tools still do not use D1.
- Phase 0: **complete**. Phase 0B remote ChatGPT connectivity and Phase 0C visual transport were manually verified: readiness returned the expected static result; image interpretation was `NAMI`, PDF interpretation was `MORI; green`.
- Public Worker: `https://hibiki-digest-phase0b.themrsean.workers.dev`; MCP endpoint: `https://hibiki-digest-phase0b.themrsean.workers.dev/mcp`.
- The deployed endpoint exposes exactly `phase0_probe`, `phase0_image_probe`, and `phase0_pdf_probe`. Slice 1B changes no MCP handlers or public tool contract.
- Validated initial production transport remains direct MCP images and embedded binary `application/pdf` resources. Raw source content stays transient.
- Local D1: both migrations apply successfully to a fresh isolated database. A separately populated, migration-ledger-tracked 0001 database upgrades through 0002 with foreign-key integrity and existing identifiers/relationships preserved. The persistent local Wrangler database also applied 0002 successfully.
- Production D1 database `hibiki-digest` exists in WNAM with database ID `62a791e5-367a-487f-bb70-140b31e0d055`. `wrangler.jsonc` binds it as `DB`; migrations remain in `migrations/`.
- [REQUIREMENTS.md](REQUIREMENTS.md) is authoritative; [DATA_MODEL.md](DATA_MODEL.md) describes the final 23-table local schema and upgrade compatibility mappings.
- Next intended slice: implement the authenticated production MCP boundary and source retrieval against the existing normalized D1 schema, after selecting the exact scope for that slice. Do not add D1 behavior to the three temporary Phase 0 tools.

## Slice 1B implementation and verification

- Initial `npm run check`: passed (3 test files, 20 tests, typecheck, lint, format check).
- `npx wrangler whoami`: authenticated as `themrsean@gmail.com`; D1 and Worker write permissions were present.
- `npx wrangler d1 list`: returned no databases. Created exactly one database named `hibiki-digest`; ID `62a791e5-367a-487f-bb70-140b31e0d055`.
- Remote migration status before application listed `0001_initial_schema.sql` and `0002_requirement_alignment.sql` as pending. Both applied successfully; remote status afterward listed both as applied.
- Remote read-only schema verification matched the local migrated product schema: 23 tables, all expected tables and representative 0002 columns, expected indexes, both migration ledger entries, and zero `PRAGMA foreign_key_check` violations. No production rows were inserted.
- `npm test`: passed (3 files, 20 tests); `npm run typecheck`, `npm run lint`, `npm run format:check`, and final `npm run check`: passed. The migration test fixture now uses the configured D1 ID so its two local migration commands address the same isolated database.
- `npm run deploy -- --dry-run`: passed and showed `env.DB (hibiki-digest)`. Actual deployment succeeded at `https://hibiki-digest-phase0b.themrsean.workers.dev`, version `962a3c7e-0414-4ab2-ab15-2f1926d8b301`.
- Remote MCP SDK regression check passed: exactly the same three tools; `phase0_probe` returned `{"service":"HibikiDigest","phase":"0B","status":"ready"}`; image content remained valid `image/png`; PDF content remained an embedded binary `application/pdf` resource.
- `npm audit --omit=dev`: 3 high-severity OAuth-related transitive findings remain across the MCP client/SDK and `agents`; the suggested remediation is a breaking `agents` change and was not applied.
- Added `npm run d1:migrate:remote` and read-only `npm run d1:verify:remote` for repeatable operator use. The DB binding is deployed but application D1 behavior remains unimplemented.

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
