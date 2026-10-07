# Project Status

- Current phase: Phase 1, Slice 1A — **complete** local normalized D1 schema foundation.
- Phase 0: **complete**.
- Phase 0B remote ChatGPT connectivity: **manually verified**. `phase0_probe` at the deployed endpoint returned exactly `{"service":"HibikiDigest","phase":"0B","status":"ready"}`.
- Phase 0C visual transport: **manually verified**. ChatGPT interpreted the image probe as `NAMI` and the PDF probe as `MORI; green`.
- Public Worker: `https://hibiki-digest-phase0b.themrsean.workers.dev`; MCP endpoint: `https://hibiki-digest-phase0b.themrsean.workers.dev/mcp`.
- The deployed endpoint exposes exactly `phase0_probe`, `phase0_image_probe`, and `phase0_pdf_probe`. Slice 1A does not add or remove public tools, so its visible behavior remains unchanged.
- Validated initial production transport: direct MCP image content for ordinary visual images and embedded binary `application/pdf` MCP resources for PDF sources. Raw source content remains transient.
- Local D1 foundation: `DB` is configured for local Wrangler use, and `migrations/0001_initial_schema.sql` creates the normalized audit, Discord observation, source-reference, performance, practice, question, poll, and anti-duplication state tables. Focused migration tests use an isolated temporary local D1 database.
- Deferred user action: create the remote D1 database and add its account-specific database ID to Wrangler configuration in a later, explicitly scoped deployment slice. No remote D1 has been provisioned here.
- Dependency warning: `npm audit --omit=dev` reports three high-severity transitive MCP OAuth advisories through `agents`. The available automated remediation is a breaking `agents` change; it is deferred from this schema slice.
- Next intended slice: establish authenticated read-only source retrieval and audit workflow boundaries, after remote D1 provisioning is explicitly authorized.
