# Product Requirements

This is the durable product requirements source for fresh coding-agent sessions, not a claim of implemented functionality. See [STATUS.md](STATUS.md) for progress, [ARCHITECTURE.md](ARCHITECTURE.md) for implementation context, [DATA_MODEL.md](DATA_MODEL.md) for schema details, [INSTRUMENTS.md](INSTRUMENTS.md) for instrument vocabulary, and [MCP_CONTRACT.md](MCP_CONTRACT.md) for tool boundaries.

## Purpose and responsibility

HibikiDigest audits one small performance-group Discord server and provides useful ChatGPT digests and current-state answers. ChatGPT performs semantic interpretation. The service performs mechanical retrieval, authentication, source handling, and persistence of normalized state. Discord is always read-only; no capability may mutate Discord or Google sources.

## Audit modes and scheduling

- Primary scheduled delivery is a shared ChatGPT Team Task, daily including weekends at 9:00 AM America/Chicago with automatic DST handling.
- Scheduled windows begin at the previous successful scheduled audit, not a rolling 24 hours. Failed or partial audits never advance that checkpoint; the next successful run catches up.
- On-demand audits default to the window since the most recent successful scheduled audit and allow custom windows. They may update normalized current state but never advance the scheduled checkpoint.
- Only one state-changing audit may run at a time.
- Run a manual baseline before enabling recurrence. Report all currently relevant/unresolved information rather than silently constructing state. Scan full histories of currently active performance channels, 30 days of other monitored channels, and all pinned messages regardless of age.

## Digest delivery and current-state answers

- Prefer high recall because traffic is low; impose no arbitrary noteworthy-item cap. Ordinary items appear only when first detected or materially changed.
- Scheduled delivery is silent if nothing noteworthy changed, no important unresolved question exists, and no degraded-audit warning exists. Important unresolved questions persist until resolved/retired. A partial/degraded warning itself causes delivery.
- Every delivered digest includes current next-practice readiness, even when readiness did not change. Organization is flexible rather than fixed sections; related messages may be grouped.
- Surfaced Discord items normally include concise paraphrase, author, Central Time timestamp, channel, and direct Discord message link. Grouped updates use the latest relevant message link. Brief suggested actions may help, but factual reporting is primary.
- ChatGPT may answer from persisted current state without forcing another audit. Important facts include Discord/source provenance when available. Facts with invalid supporting sources must not be presented as current verified facts.

## Discord coverage and structure

- Configure exactly one guild by stable ID; ignore other guilds even if the bot is invited. Ignore DMs and all bot/webhook/non-human authors.
- Automatically monitor human-authored messages in every non-archived channel, thread, and forum post. Exclude everything under the configured Archived category and the configured `#google-calendar-link` channel. Discover new non-archived channels/categories automatically.
- New channel/category creation is noteworthy. Thread creation itself is not. Meaningful category renames are noteworthy; cosmetic renames are not. Ignore channel topics/descriptions.
- Meaningful performance-channel renames, such as event/date changes, are noteworthy and update derived event information.
- Moving a channel to Archived is cleanup, not a digest item. Channel deletion itself is not noteworthy. Archiving a performance channel removes associated current state.
- Monitor performance channels after their events until archived to capture post-performance follow-up.

## Messages, pins, edits, and missing sources

- Newly pinned messages are always noteworthy, even if previously reported. Unpinning is not.
- Meaningful edits are noteworthy; typo/cosmetic edits are not. Active performance histories may be rescanned in full for edits; other monitored channels use approximately a 30-day rescan window.
- Message observations support edit detection without retaining raw bodies.
- If an important audited source message disappears and was the only support for a fact, remove/retire that fact and flag it as unsupported/unknown when relevant.
- Messages created and deleted between audits may be missed under the serverless/on-demand architecture; this limitation is accepted.
- Replies/quotes may fetch older referenced messages outside the normal window for context. These are not automatically new noteworthy items.

## Semantic noteworthiness and mentions

Use semantic judgment rather than a rigid keyword checklist. Examples include performances; accepted/inquired performance changes; event dates/times; call times; venue/parking/transport; staffing and availability; repertoire/set lists; equipment/instruments; cancellations; performance-related rehearsal; confirmations; unresolved decisions/questions; practice updates; repertoire changes; membership/new-member information; dues/policies; organizational changes; and meaningful ideas/decisions. Exclude ordinary social chatter. All performance-related questions are important, not only those directed to Sean.

Special mention handling applies only to Sean. Explicit `Sean` or an actual `@themrsean` Discord mention is sufficient and is surfaced even outside performance topics. Do not infer Sean from pronouns or indirect references. Ignore emoji reactions entirely, including as confirmations.

## Questions and polls

- Important unresolved questions from any monitored area persist until resolved or retired. ChatGPT determines resolution semantically. States are open, partially resolved, and resolved. Partial answers update the summary but remain unresolved.
- Persist original ask time and most recent relevant activity time. Subsequent digests clearly identify continuing questions as still unresolved.
- A performance-related question may retire after the event date passes even if the channel remains active. Newly resolved questions are noteworthy once. Retain resolved-question state 30 days, then delete it.
- Consider polls on every topic. New poll information/activity is noteworthy. Persist question, options, aggregate per-option vote counts, and open/closed state; never individual voter identities.
- Open polls reappear only when totals change. Closed polls report final totals. Do not separately declare a winner.

## Transient links and attachments

- Inspect directly linked material when useful for understanding a noteworthy post. Follow at most one additional embedded-link depth when clearly relevant; do not crawl broadly.
- Record inaccessible/login-protected linked sources only when relevant. Inaccessibility alone does not trigger a digest.
- Supported transient attachments include common images, PDFs, text, DOCX, CSV, XLSX, and similar ordinary formats. Ignore audio/video and ZIP/compressed archives. Maximum processed attachment size is 20 MB.
- Mention oversize/unsupported skips only when a digest is otherwise delivered.
- Discard attachments and linked-source contents after interpretation; persist only normalized state and provenance.
- Initial production visual transport uses MCP image content for images and embedded `application/pdf` MCP resources for PDFs. Phase 0 proved both visually interpretable by ChatGPT.

## Provenance and retention

For Discord/document-derived facts, retain enough provenance to identify Discord channel/message, message link, useful author identity/display name, message timestamp, and specific attachment or source URL when available. Normal digests link to the Discord message; specific source URL/attachment provenance may be provided when asked. Never persist raw Discord bodies, attachment bytes, or document contents.

Retain ordinary reported-item fingerprints/message references approximately one year to prevent duplicates; archived-channel state may be removed sooner. Retain audit-run operational metadata 90 days: scheduled/on-demand/baseline mode, success/partial/failure, useful counts, failed sources/errors, and authenticated initiator for on-demand runs. Metadata contains no raw message content.

## Performance current state and plans

Performance channels normally have names such as `2026-oct-25-mia-japanfest`. Names reliably seed event date/name; explicit authoritative Discord-message details override derived information. Plans normally appear in the corresponding channel. For plans elsewhere, association may be inferred from filename, surrounding message, and matching event/date information. Flag ambiguous association rather than guess.

A newer performance-plan PDF always completely supersedes the older PDF for that performance. Track current, not superseded historical, values: event name/date, venue, call/arrival time, performance time, confirmed performers, repertoire/set list, equipment/logistics, open questions, relevant miscellaneous notes, and detailed per-song performer assignments/responsibilities. Explicit newer authoritative information supersedes prior values; surface meaningful contradictions.

Performance-plan PDFs contain meaningful graphical/spatial relationships. ChatGPT must visually infer performer-to-instrument/responsibility relationships rather than rely only on extracted text. Preserve as much visible assignment detail as possible.

Instrument vocabulary: beta nagado, seated nagado, naname nagado, shime, oodaiko, fue, chanchiki, tachi okedo, yagura oodaiko, chappa, and okedo. Nagado color identifies a specific physical drum; shime is also differentiated by color. Other listed instruments do not require color identity. Normalized examples: `red seated nagado`, `yellow naname nagado`, `green shime`. See [INSTRUMENTS.md](INSTRUMENTS.md).

## Practice source and current state

The [Google practice spreadsheet](https://docs.google.com/spreadsheets/d/1tqFZuMFKMKrYvvhl8EPgbuUJZX4RGjbOqu9jORECvFI/edit?gid=0#gid=0), only `gid=0`, provides authoritative practice dates. Google Calendar is not used. Discord is authoritative when it conflicts with the sheet; explicitly flag contradictions rather than silently reconcile them.

- Check the sheet on every scheduled audit, even without new Discord messages. Its expected stable layout may use a purpose-built parser. Parser/layout failure creates a visible degraded-audit warning.
- The sheet explicitly lists people who will NOT attend; assume everyone not listed is attending. Detect and report newly added/removed absences.
- Store all upcoming practices with date/time, location, planned repertoire, known absences, and open questions. Remove a practice from current state once its date passes. Practice-related digest items may link directly to the sheet.
- Practice plans, usually PDFs, mainly identify songs/sections to rehearse. Associate them with scheduled practice information. Without an upcoming-practice plan, explicitly say "Practice plan not yet available."

## Next-practice selection and readiness

Practice week is Monday–Sunday in America/Chicago. Use the next relevant practice in the current week; if this week's practice has finished, advance to the following week's practice. Other noteworthy Discord information is not restricted to that week.

Readiness is a first-class, high-priority digest capability. For the next practice:

1. Read songs/sections from the practice plan and cross-reference every scheduled song with all upcoming performance plans.
2. Organize by song, not performer. Show each performance's specific assignments separately, including different assignments for the same song at multiple performances.
3. Include playing assignments and non-playing responsibilities: introductions/speaking, setup/transitions, moving/removing drums, cues/interludes, and audience interaction.
4. Cross-reference absences and explicitly flag assigned performers who will miss rehearsal. Suggest no substitutes unless Discord explicitly established them.
5. For a practice song without an upcoming performance assignment, say "no upcoming performance assignment found."
6. Keep readiness concise: explicit absences, relevant performers/parts, and conflicts rather than the full assumed-attendance roster.

## Authentication, MCP, and health

Production MCP must be private/authenticated before exposing private source data or meaningful writes. Intended authentication is Google identity and an explicit approved-email allowlist in private deployment configuration; no admin UI is required. All intended users are expected to have Google accounts. Approved workspace members may run on-demand audits and update shared normalized state. No user receives Discord write capability.

Planned tools: `prepare_audit`, `read_sources`, `commit_audit`, `get_current_state`, `get_health`, and `get_audit_history`; see [MCP_CONTRACT.md](MCP_CONTRACT.md). Prefer high-level tools over raw Discord API plumbing. Retrieval is mechanical and ChatGPT performs semantic analysis. `commit_audit` is the only state-writing MCP operation and may modify only Hibiki normalized/internal state.

Health/status reports Discord, practice-sheet, and D1 reachability; last successful scheduled audit; and complete/partial status. Include no message content.

## Engineering constraints

Use TypeScript, npm, strict TypeScript, Vitest, ESLint, Prettier, Cloudflare Workers, and Cloudflare D1. Prefer serverless and free-tier-first design. GitHub is public: never commit secrets or private allowlists. Automatic Cloudflare deployment after CI is a later goal once deployment credentials are safely configured.

Preserve [AGENTS.md](../AGENTS.md): TDD for generated production behavior; no `break`, `continue`, or `while (true)`; no early return from void functions; named constants instead of unexplained behavioral/configuration numeric literals; small functions and explicit types; no casual `any` (document a compelling boundary reason). Keep implementation, tests, and documentation synchronized and update status after every slice.
