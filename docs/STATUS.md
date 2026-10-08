# Project Status

- Current phase: Phase 1, Slice 1B.2 — **complete**. The permanent Worker now uses the native MCP v2 handler; production dependency audit is clean, remote regression passed, and the obsolete Phase 0 Worker is retired. Production MCP tools still do not use D1.
- Phase 0: **complete**. Phase 0B remote ChatGPT connectivity and Phase 0C visual transport were manually verified: readiness returned the expected static result; image interpretation was `NAMI`, PDF interpretation was `MORI; green`.
- Public Worker: `https://hibiki-digest.themrsean.workers.dev`; MCP endpoint: `https://hibiki-digest.themrsean.workers.dev/mcp`.
- The user manually connected ChatGPT to the permanent `/mcp` endpoint and invoked `phase0_probe`, receiving exactly `{"service":"HibikiDigest","phase":"0B","status":"ready"}`. After Slice 1B.2 deployment and remote regression, exactly `hibiki-digest-phase0b` was deleted; the permanent Worker remained healthy.
- The deployed endpoint exposes exactly `phase0_probe`, `phase0_image_probe`, and `phase0_pdf_probe`. Slice 1B.2 preserves the public tool contract and fixture contents.
- Validated initial production transport remains direct MCP images and embedded binary `application/pdf` resources. Raw source content stays transient.
- Local D1: both migrations apply successfully to a fresh isolated database. A separately populated, migration-ledger-tracked 0001 database upgrades through 0002 with foreign-key integrity and existing identifiers/relationships preserved. The persistent local Wrangler database also applied 0002 successfully.
- Production D1 database `hibiki-digest` exists in WNAM with database ID `62a791e5-367a-487f-bb70-140b31e0d055`. `wrangler.jsonc` binds it as `DB`; migrations remain in `migrations/`.
- [REQUIREMENTS.md](REQUIREMENTS.md) is authoritative; [DATA_MODEL.md](DATA_MODEL.md) describes the final 23-table local schema and upgrade compatibility mappings.
- OAuth remains unimplemented. Next intended slice: authenticated MCP on the permanent hostname, with Google identity and a private approved-email allowlist, before source retrieval or meaningful writes. Do not add D1 behavior to the three temporary Phase 0 tools.

## Slice 1B.2 implementation and verification

- Read all repository docs before editing; `REQUIREMENTS.md` remains authoritative and unchanged. Consulted current official [MCP v2 HTTP serving documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md), [native handler API/source](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/server/src/server/createMcpHandler.ts), and [Cloudflare fetch handler documentation](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/). npm registry `latest` tags selected mutually compatible stable server/client `2.3.1`.
- Baseline complete `npm run check`: passed (3 files, 20 tests; typecheck, lint, formatting). Baseline `npm audit --omit=dev`: 3 high findings from [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h), OAuth client credentials sent to an untrusted authorization server. Exact installed paths: root → `agents@0.27.0` → peer `@modelcontextprotocol/client@2.0.0` (also a direct dev dependency promoted into the production peer tree), and root → `agents@0.27.0` → peer `@modelcontextprotocol/sdk@1.30.0`. npm reports the third high finding on `agents` through those two peers. Advisory affected ranges: client `>=2.0.0 <2.2.0`, legacy SDK `>=1.12.0 <1.31.0`. The suggested breaking Agents downgrade was not used.
- Removed direct `agents@0.27.0` and its obsolete transitive/peer tree, including legacy `@modelcontextprotocol/sdk@1.30.0`. `npm ls` confirms neither Agents nor the legacy SDK remains installed. Updated direct server and dev client from `2.0.0` to `2.3.1` (`^2.3.1` declarations), with shared core `2.3.1`. All other retained package versions are unchanged. No overrides or replacement framework were added.
- Serving now imports `createMcpHandler` directly from `@modelcontextprotocol/server`; the factory still creates a fresh server per request. Explicit `legacy: "stateless"` preserves 2025-era interoperability. An exact pathname guard limits MCP to `/mcp`; `/`, `/authorize`, arbitrary paths, `/mcp/`, and `/mcp/message` return plain `404 Not Found`. Tools, annotations, readiness JSON, image content, and embedded PDF resources are unchanged. D1 application behavior remains absent.
- TDD: before production edits, expanded focused MCP coverage from 3 to 10 tests. The first red run had 1 failure (native handler was not called) and 9 passes; existing diagnostic tests and new route/stateless legacy tests already passed. After implementation, the import-time mock call record still read zero, so instrumentation was corrected to retain the native factory/options rather than relying on the unreliable import-time spy history. A subsequent sensitivity check with the explicit legacy option temporarily omitted produced 1 failure/9 passes; restoring the option produced 10 passes. The factory test checks distinct modern/legacy server instances; legacy calls work repeatedly without initialization or session headers. No existing passing regression was represented as a behavior failure.
- Final focused MCP tests: 10 passed. `npm test`: 3 files, 27 tests passed. `npm run typecheck`, `npm run lint`, `npm run format:check`, and complete `npm run check`: passed. Local D1 test listeners required execution outside the filesystem/network sandbox; sandbox permission errors were not counted as product failures.
- `npm run d1:verify:remote`: passed on retry after a transient Cloudflare 7403 authorization error. Read-only account/database inspection confirmed the existing database identity. No remote migrations or application D1 writes were performed.
- `npm run deploy -- --dry-run`: passed with existing `env.DB (hibiki-digest)`. Permanent deployment succeeded at `https://hibiki-digest.themrsean.workers.dev`, version `a1284b1f-5e03-49a3-aca0-4771f9d71c34`.
- Remote MCP v2 regression: passed before and after old Worker deletion. Exactly the three diagnostic tools and unchanged annotations; readiness content exactly `{"service":"HibikiDigest","phase":"0B","status":"ready"}`; PNG bytes match the fixture (1,370 bytes, valid PNG signature); embedded PDF bytes match the fixture (860 bytes, valid PDF signature). Legacy stateless calls also returned identical content for all three tools; no session headers. Unrelated paths returned plain 404 for GET and POST. No authentication was configured.
- Verified `hibiki-digest-phase0b` by its exact named deployment history, including prior version `962a3c7e-0414-4ab2-ab15-2f1926d8b301`. `wrangler delete hibiki-digest-phase0b` reported success. The permanent Worker and its D1 database were preserved; permanent health regression passed afterward.
- Final `npm audit --omit=dev`: **found 0 vulnerabilities**, including zero high MCP/OAuth findings. Broader `npm audit` still reports 3 high development-tool findings through `wrangler@4.148.0` → `miniflare@5.20261006.0-alpha` → `sharp@0.35.4`, [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) (librsvg CVE-2026-96889). This unrelated development dependency warning remains; npm proposes a breaking Wrangler downgrade, which was not applied. Installation also emitted transient old Agents peer-resolution warnings during removal and pending install-script approval notices for existing tooling; required gates and deployment succeeded without approving scripts.
- OAuth, secrets, KV, consent flows, source retrieval, and private-data tools remain unimplemented. Authenticated MCP is the next slice.

## Slice 1B.1 implementation and verification

- Pre-change `npm run check`: passed (3 test files, 20 tests; typecheck, lint, and format check passed).
- `wrangler.jsonc` now names the production Worker `hibiki-digest`; its `DB` binding, D1 database name and ID, migrations, and compatibility settings are unchanged.
- New Worker URL: `https://hibiki-digest.themrsean.workers.dev`; MCP URL: `https://hibiki-digest.themrsean.workers.dev/mcp`.
- `npm run d1:verify:remote`: passed; remote schema and migration verification remain valid.
- `npm test`: passed (3 files, 20 tests). `npm run typecheck`, `npm run lint`, and `npm run format:check`: passed. Complete post-change `npm run check`: passed; the pre-change gate passed with the same results.
- `npm run deploy -- --dry-run`: passed and showed `env.DB (hibiki-digest)`. Actual deployment succeeded at `https://hibiki-digest.themrsean.workers.dev`, version `a795134a-449b-48b9-a37a-657c55af023a`.
- Remote MCP regression at `https://hibiki-digest.themrsean.workers.dev/mcp`: passed. Exactly `phase0_image_probe`, `phase0_pdf_probe`, and `phase0_probe` are exposed; readiness returned exactly `{"service":"HibikiDigest","phase":"0B","status":"ready"}`; image content was valid `image/png` (1,370 bytes); PDF content was an embedded binary `application/pdf` resource (860 bytes). Deployment output confirmed the `DB` binding is present.
- `npm audit --omit=dev`: reports 3 high-severity OAuth-related transitive findings across the MCP client/SDK and `agents`; suggested fix is a breaking `agents` downgrade. Dependencies remain unchanged for the dedicated authentication/security slice.
- Authentication/OAuth configuration against the permanent hostname is the next slice.

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
- Track the remaining development-tool librsvg advisory separately; the production MCP dependency security baseline is verified.
