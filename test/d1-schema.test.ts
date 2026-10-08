import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "../src/database.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("..", import.meta.url));
const WRANGLER_EXECUTABLE = join(
  REPOSITORY_ROOT,
  "node_modules",
  ".bin",
  "wrangler",
);
const D1_TEST_TIMEOUT_MS = 30_000;
const D1_BINDING = "DB";
const D1_DATABASE_ID = "62a791e5-367a-487f-bb70-140b31e0d055";
const LOCAL_STATE_PREFIX = "hibiki-digest-d1-";
const TABLE_NAMES = [
  "audit_checkpoint",
  "audit_runs",
  "audit_lock",
  "reported_items",
  "discord_categories",
  "discord_channels",
  "message_observations",
  "source_refs",
  "performances",
  "performance_assignments",
  "practices",
  "practice_items",
  "practice_absences",
  "questions",
  "polls",
  "poll_options",
  "audit_source_errors",
  "performance_plans",
  "practice_plans",
  "performance_field_sources",
  "performance_performers",
  "performance_repertoire",
  "performance_notes",
];
let localStateDirectory = "";

interface D1QueryResult {
  results: Array<Record<string, unknown>>;
}

function runD1Queries(
  sql: string,
  stateDirectory = localStateDirectory,
): D1QueryResult[] {
  const output = execFileSync(
    WRANGLER_EXECUTABLE,
    [
      "d1",
      "execute",
      D1_BINDING,
      "--local",
      "--persist-to",
      stateDirectory,
      "--command",
      sql,
      "--json",
    ],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  );
  const results = JSON.parse(output) as D1QueryResult[];
  return results;
}

function runD1(
  sql: string,
  stateDirectory = localStateDirectory,
): D1QueryResult {
  return runD1Queries(sql, stateDirectory)[0];
}

function tableColumnNames(tableName: string): string[] {
  return runD1(`PRAGMA table_info('${tableName}')`).results.map((row) =>
    String(row.name),
  );
}

function indexNames(tableName: string): string[] {
  return runD1(`PRAGMA index_list('${tableName}')`).results.map((row) =>
    String(row.name),
  );
}

describe("local D1 schema", { timeout: D1_TEST_TIMEOUT_MS }, () => {
  beforeAll(() => {
    localStateDirectory = mkdtempSync(join(tmpdir(), LOCAL_STATE_PREFIX));
    execFileSync(
      WRANGLER_EXECUTABLE,
      [
        "d1",
        "migrations",
        "apply",
        D1_BINDING,
        "--local",
        "--persist-to",
        localStateDirectory,
      ],
      { cwd: REPOSITORY_ROOT, encoding: "utf8" },
    );
  });

  afterAll(() => {
    rmSync(localStateDirectory, { force: true, recursive: true });
  });

  it("applies the migrations and creates every normalized state table", () => {
    const tables = runD1(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'd1_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).results.map((row) => String(row.name));

    expect(tables).toEqual([...TABLE_NAMES].sort());
  });

  it("enforces representative uniqueness and foreign-key constraints", () => {
    runD1(
      "INSERT INTO discord_categories (discord_category_id, name, observed_at) VALUES ('category-1', 'Performances', '2026-10-07T00:00:00Z')",
    );

    expect(() =>
      runD1(
        "INSERT INTO discord_categories (discord_category_id, name, observed_at) VALUES ('category-1', 'Duplicate', '2026-10-07T00:00:00Z')",
      ),
    ).toThrow();
    expect(() =>
      runD1(
        "INSERT INTO discord_channels (discord_channel_id, discord_category_id, name, channel_kind, observed_at) VALUES ('channel-orphan', 'missing-category', 'Orphan', 'performance', '2026-10-07T00:00:00Z')",
      ),
    ).toThrow();
  });

  it(
    "stores traceability and normalized operational data without raw source content",
    () => {
      runD1(
        "INSERT INTO discord_channels (discord_channel_id, discord_category_id, name, channel_kind, observed_at) VALUES ('channel-1', 'category-1', 'Spring Show', 'performance', '2026-10-07T00:00:00Z')",
      );
      runD1(
        "INSERT INTO source_refs (source_ref_id, source_kind, discord_channel_id, discord_message_id, observed_at) VALUES ('source-1', 'discord_message', 'channel-1', 'message-1', '2026-10-07T00:00:00Z')",
      );
      runD1(
        "INSERT INTO performances (performance_id, discord_channel_id, title, status, source_ref_id, created_at) VALUES ('performance-1', 'channel-1', 'Spring Show', 'active', 'source-1', '2026-10-07T00:00:00Z')",
      );
      runD1(
        "INSERT INTO performance_assignments (assignment_id, performance_id, performer_name, song_title, instrument, instrument_color, responsibility, source_ref_id, created_at) VALUES ('assignment-1', 'performance-1', 'Aiko', 'Festival Song', 'shime', 'green', 'Lead cue', 'source-1', '2026-10-07T00:00:00Z')",
      );
      runD1(
        "INSERT INTO practices (practice_id, discord_channel_id, scheduled_at, status, source_ref_id, created_at) VALUES ('practice-1', 'channel-1', '2026-11-01T18:00:00Z', 'planned', 'source-1', '2026-10-07T00:00:00Z')",
      );
      runD1(
        "INSERT INTO practice_absences (practice_id, member_name, member_discord_user_id, source_ref_id, created_at) VALUES ('practice-1', 'Aiko', 'member-1', 'source-1', '2026-10-07T00:00:00Z')",
      );
      runD1(
        "INSERT INTO polls (poll_id, discord_channel_id, subject, status, response_total, source_ref_id, created_at) VALUES ('poll-1', 'channel-1', 'Bring drum covers', 'open', 7, 'source-1', '2026-10-07T00:00:00Z')",
      );

      expect(
        runD1(
          "SELECT performer_name, instrument_color, responsibility FROM performance_assignments",
        ).results,
      ).toEqual([
        {
          performer_name: "Aiko",
          instrument_color: "green",
          responsibility: "Lead cue",
        },
      ]);
      expect(
        runD1("SELECT member_discord_user_id FROM practice_absences").results,
      ).toEqual([{ member_discord_user_id: "member-1" }]);
      expect(tableColumnNames("message_observations")).not.toContain(
        "raw_message_body",
      );
      expect(tableColumnNames("source_refs")).not.toContain("source_content");
      expect(tableColumnNames("source_refs")).not.toContain("content_bytes");
      expect(tableColumnNames("practice_absences")).not.toContain("is_present");
      expect(tableColumnNames("polls")).toEqual(
        expect.arrayContaining(["status", "response_total"]),
      );
      expect(tableColumnNames("polls")).not.toContain("voter_discord_user_id");
    },
    D1_TEST_TIMEOUT_MS,
  );

  it("provides the indexes needed for later audit and digest queries", () => {
    expect(indexNames("reported_items")).toContain(
      "reported_items_digest_key_unique",
    );
    expect(indexNames("message_observations")).toContain(
      "message_observations_channel_observed_at_idx",
    );
    expect(indexNames("performance_assignments")).toContain(
      "performance_assignments_performance_idx",
    );
    const indexes = runD1(
      "SELECT name FROM sqlite_master WHERE type = 'index'",
    ).results.map((row) => String(row.name));
    expect(indexes).toEqual(
      expect.arrayContaining([
        "performance_assignments_plan_idx",
        "practice_items_plan_idx",
        "performance_plans_current_unique",
        "practice_plans_current_unique",
        "questions_resolved_at_idx",
        "audit_runs_started_at_idx",
        "reported_items_last_reported_at_idx",
        "source_refs_validity_idx",
      ]),
    );
  });

  it(
    "upgrades populated 0001 state without losing relationships",
    () => {
      const upgradeState = mkdtempSync(join(tmpdir(), LOCAL_STATE_PREFIX));
      const upgradeMigrations = join(upgradeState, "migrations");
      const upgradeConfig = join(upgradeState, "wrangler.json");
      mkdirSync(upgradeMigrations);
      writeFileSync(
        upgradeConfig,
        JSON.stringify({
          d1_databases: [
            {
              binding: D1_BINDING,
              database_name: "hibiki-digest",
              database_id: D1_DATABASE_ID,
              migrations_dir: upgradeMigrations,
            },
          ],
        }),
      );
      try {
        for (const migration of [
          "0001_initial_schema.sql",
          "0002_requirement_alignment.sql",
        ]) {
          expect(
            existsSync(join(REPOSITORY_ROOT, "migrations", migration)),
          ).toBe(true);
          copyFileSync(
            join(REPOSITORY_ROOT, "migrations", migration),
            join(upgradeMigrations, migration),
          );
          execFileSync(
            WRANGLER_EXECUTABLE,
            [
              "d1",
              "migrations",
              "apply",
              D1_BINDING,
              "--local",
              "--persist-to",
              upgradeState,
              "--config",
              upgradeConfig,
            ],
            { cwd: REPOSITORY_ROOT, encoding: "utf8" },
          );
          if (migration === "0001_initial_schema.sql") {
            runD1(
              `INSERT INTO audit_runs VALUES ('legacy-run', 'succeeded', '2026-10-01', '2026-10-02', NULL);
            INSERT INTO audit_lock VALUES ('audit', 'legacy-run', '2026-10-01', '2026-10-02');
            INSERT INTO audit_checkpoint VALUES ('scheduled', 'legacy-run', '2026-10-02', '2026-10-02');
            INSERT INTO discord_channels VALUES ('legacy-channel', NULL, 'Legacy', 'practice', '2026-10-01', NULL);
            INSERT INTO source_refs VALUES ('legacy-source', 'discord_message', 'legacy-channel', 'legacy-message', NULL, '2026-10-01');
            INSERT INTO practices VALUES ('legacy-practice', 'legacy-channel', '2026-11-01', 'planned', 'legacy-source', '2026-10-01');
            INSERT INTO practice_items VALUES ('legacy-item', 'legacy-practice', 1, 'Old song', 'legacy-source');
            INSERT INTO performances VALUES ('legacy-performance', 'legacy-channel', 'Legacy event', '2026-11-01', 'active', 'legacy-source', '2026-10-01');
            INSERT INTO performance_assignments VALUES ('legacy-assignment', 'legacy-performance', 'Aiko', 'Old song', 'shime', 'green', NULL, 'legacy-source', '2026-10-01');
            INSERT INTO message_observations VALUES ('legacy-message', 'legacy-channel', 'legacy-user', '2026-10-01', NULL, 0, '2026-10-01');
            INSERT INTO practice_absences VALUES ('legacy-practice', 'legacy-user', 'legacy-source', '2026-10-01');
            INSERT INTO questions VALUES ('legacy-question', 'legacy-channel', 'Answered?', 'answered', 'legacy-source', '2026-10-01', NULL);
            INSERT INTO questions VALUES ('legacy-closed', 'legacy-channel', 'Closed?', 'closed', 'legacy-source', '2026-10-01', '2026-10-02');
            INSERT INTO questions VALUES ('legacy-open', 'legacy-channel', 'Open?', 'open', 'legacy-source', '2026-10-01', NULL);
            INSERT INTO reported_items VALUES ('legacy-report', 'legacy-key', 'legacy-source', '2026-10-01', '2026-10-01', 1);`,
              upgradeState,
            );
          }
        }
        expect(runD1("PRAGMA foreign_key_check", upgradeState).results).toEqual(
          [],
        );
        expect(
          runD1(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'd1_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%' ORDER BY name",
            upgradeState,
          ).results.map((row) => String(row.name)),
        ).toEqual([...TABLE_NAMES].sort());
        expect(
          runD1(
            "SELECT status, asked_at, resolved_at FROM questions WHERE question_id = 'legacy-question'",
            upgradeState,
          ).results,
        ).toEqual([
          {
            status: "resolved",
            asked_at: "2026-10-01",
            resolved_at: "2026-10-01",
          },
        ]);
        expect(
          runD1(
            "SELECT member_name, member_discord_user_id FROM practice_absences",
            upgradeState,
          ).results,
        ).toEqual([
          { member_name: "legacy-user", member_discord_user_id: "legacy-user" },
        ]);
        expect(
          runD1("SELECT audit_run_id FROM audit_checkpoint", upgradeState)
            .results,
        ).toEqual([{ audit_run_id: "legacy-run" }]);
        expect(
          runD1("SELECT source_ref_id FROM reported_items", upgradeState)
            .results,
        ).toEqual([{ source_ref_id: "legacy-source" }]);
        expect(
          runD1("SELECT performance_at FROM performances", upgradeState)
            .results,
        ).toEqual([{ performance_at: "2026-11-01" }]);
        expect(
          runD1("SELECT song_title FROM practice_items", upgradeState).results,
        ).toEqual([{ song_title: "Old song" }]);
        expect(
          runD1(
            "SELECT instrument_color, performance_plan_id FROM performance_assignments",
            upgradeState,
          ).results,
        ).toEqual([{ instrument_color: "green", performance_plan_id: null }]);
        expect(
          runD1("SELECT holder_audit_run_id FROM audit_lock", upgradeState)
            .results,
        ).toEqual([{ holder_audit_run_id: "legacy-run" }]);
        expect(
          runD1("SELECT name FROM d1_migrations ORDER BY id", upgradeState)
            .results,
        ).toEqual([
          { name: "0001_initial_schema.sql" },
          { name: "0002_requirement_alignment.sql" },
        ]);
      } finally {
        rmSync(upgradeState, { force: true, recursive: true });
      }
    },
    D1_TEST_TIMEOUT_MS,
  );

  it(
    "represents audit modes, partial outcomes, initiators and relational source errors",
    () => {
      runD1(`INSERT INTO audit_runs (audit_run_id, audit_mode, status, started_at, completed_at, initiator_identity, messages_observed, sources_processed, items_reported) VALUES
      ('baseline', 'baseline', 'succeeded', '2026-10-01', '2026-10-02', NULL, 12, 2, 1),
      ('scheduled', 'scheduled', 'partial', '2026-10-01', '2026-10-02', NULL, 0, 0, 0),
      ('demand', 'on_demand', 'running', '2026-10-01', NULL, 'google-subject', 0, 0, 0),
      ('failed', 'scheduled', 'failed', '2026-10-01', '2026-10-02', NULL, 0, 0, 0);
      INSERT INTO audit_source_errors (audit_source_error_id, audit_run_id, source_kind, source_url, error_code, error_summary, occurred_at) VALUES ('error', 'scheduled', 'practice_sheet', 'https://example.org/sheet', 'layout_changed', 'Expected date column missing', '2026-10-01');`);
      for (const values of [
        "'bad-mode', 'weekly', 'running', '2026-10-01', NULL, 0",
        "'bad-status', 'scheduled', 'unknown', '2026-10-01', NULL, 0",
        "'bad-count', 'scheduled', 'running', '2026-10-01', NULL, -1",
        "'bad-completion', 'scheduled', 'partial', '2026-10-01', NULL, 0",
      ]) {
        expect(() =>
          runD1(
            `INSERT INTO audit_runs (audit_run_id, audit_mode, status, started_at, completed_at, messages_observed) VALUES (${values})`,
          ),
        ).toThrow();
      }
      expect(
        runD1(
          "SELECT initiator_identity FROM audit_runs WHERE audit_run_id = 'demand'",
        ).results,
      ).toEqual([{ initiator_identity: "google-subject" }]);
    },
    D1_TEST_TIMEOUT_MS,
  );

  it("tracks message fingerprints, pins, invalidation and Discord structure", () => {
    runD1(`INSERT INTO discord_channels (discord_channel_id, name, channel_kind, structural_type, parent_channel_id, observed_at, archived_at) VALUES
      ('forum', 'Forum', 'other', 'forum', NULL, '2026-10-01', NULL),
      ('post', 'Post', 'performance', 'forum_post', 'forum', '2026-10-01', NULL),
      ('thread', 'Thread', 'other', 'thread', 'channel-1', '2026-10-01', '2026-10-02');
      INSERT INTO message_observations (discord_message_id, discord_channel_id, author_discord_user_id, message_created_at, message_edited_at, content_hash, is_pinned, has_attachments, observed_at, validity, invalidated_at) VALUES ('observed', 'post', 'author', '2026-10-01', '2026-10-02', 'sha256:fingerprint', 1, 1, '2026-10-02', 'missing', '2026-10-03');`);
    expect(tableColumnNames("message_observations")).toEqual(
      expect.arrayContaining([
        "content_hash",
        "is_pinned",
        "validity",
        "invalidated_at",
        "observed_at",
      ]),
    );
    expect(() =>
      runD1("UPDATE message_observations SET is_pinned = 2"),
    ).toThrow();
    expect(() =>
      runD1(
        "UPDATE discord_channels SET structural_type = 'unknown' WHERE discord_channel_id = 'thread'",
      ),
    ).toThrow();
  });

  it(
    "supports attachment, linked-page and sheet provenance and validates kinds",
    () => {
      runD1(`INSERT INTO source_refs (source_ref_id, source_kind, discord_channel_id, discord_message_id, discord_message_url, author_discord_user_id, author_display_name, source_timestamp, discord_attachment_id, attachment_name, attachment_url, external_url, observed_at) VALUES
      ('attachment', 'discord_attachment', 'channel-1', 'message-2', 'https://discord.com/channels/g/c/m', 'author', 'Aiko', '2026-10-01', 'pdf', 'plan.pdf', 'https://example.org/plan.pdf', NULL, '2026-10-01'),
      ('link', 'linked_url', NULL, NULL, NULL, NULL, NULL, '2026-10-01', NULL, NULL, NULL, 'https://example.org/page', '2026-10-01'),
      ('sheet', 'practice_sheet', NULL, NULL, NULL, NULL, NULL, '2026-10-01', NULL, NULL, NULL, 'https://example.org/sheet', '2026-10-01');
      UPDATE source_refs SET validity = 'invalid', invalidated_at = '2026-10-03', invalidation_reason = 'deleted' WHERE source_ref_id = 'link';`);
      for (const values of [
        "'discord_message', NULL, NULL, NULL",
        "'discord_attachment', 'channel-1', 'message', NULL",
        "'linked_url', NULL, NULL, NULL",
        "'practice_sheet', NULL, NULL, NULL",
      ]) {
        expect(() =>
          runD1(
            `INSERT INTO source_refs (source_ref_id, source_kind, discord_channel_id, discord_message_id, external_url, observed_at) VALUES ('bad-source', ${values}, '2026-10-01')`,
          ),
        ).toThrow();
      }
    },
    D1_TEST_TIMEOUT_MS,
  );

  it(
    "supports sheet-only practices, names, explicit song sections and semantic questions",
    () => {
      runD1(`INSERT INTO practices (practice_id, scheduled_at, location, status, source_ref_id, created_at) VALUES ('sheet-practice', '2026-11-01T18:00:00Z', 'Studio', 'planned', 'sheet', '2026-10-01');
      INSERT INTO practice_absences (practice_id, member_name, source_ref_id, created_at) VALUES ('sheet-practice', 'Mika', 'sheet', '2026-10-01');
      INSERT INTO practice_items (practice_item_id, practice_id, sequence_number, song_title, section_notes, source_ref_id) VALUES ('song', 'sheet-practice', 1, 'Festival Song', 'Opening section', 'sheet');
      INSERT INTO questions (question_id, discord_channel_id, summary, status, source_ref_id, created_at, asked_at, last_activity_at, partial_resolution_summary, resolved_at, performance_id, practice_id) VALUES
      ('open', 'channel-1', 'Transport?', 'open', 'source-1', '2026-10-01', '2026-10-01', '2026-10-02', NULL, NULL, 'performance-1', 'sheet-practice'),
      ('partial', 'channel-1', 'Transport?', 'partially_resolved', 'source-1', '2026-10-01', '2026-10-01', '2026-10-02', 'Driver confirmed; car unknown', NULL, NULL, 'sheet-practice'),
      ('resolved', 'channel-1', 'Transport confirmed', 'resolved', 'source-1', '2026-10-01', '2026-10-01', '2026-10-02', NULL, '2026-10-02', 'performance-1', NULL);`);
      expect(
        runD1(
          "SELECT member_discord_user_id FROM practice_absences WHERE member_name = 'Mika'",
        ).results,
      ).toEqual([{ member_discord_user_id: null }]);
      for (const status of ["answered", "closed", "retired"]) {
        expect(() =>
          runD1(
            `UPDATE questions SET status = '${status}' WHERE question_id = 'open'`,
          ),
        ).toThrow();
      }
    },
    D1_TEST_TIMEOUT_MS,
  );

  it("stores poll options with aggregate counts only", () => {
    runD1(
      `INSERT INTO poll_options (poll_option_id, poll_id, sequence_number, label, vote_count) VALUES ('yes', 'poll-1', 1, 'Yes', 5), ('no', 'poll-1', 2, 'No', 2)`,
    );
    expect(
      runD1(
        "SELECT label, vote_count FROM poll_options ORDER BY sequence_number",
      ).results,
    ).toEqual([
      { label: "Yes", vote_count: 5 },
      { label: "No", vote_count: 2 },
    ]);
    expect(() => runD1("UPDATE poll_options SET vote_count = -1")).toThrow();
  });

  it(
    "identifies current plans and replaces their assignments as a unit",
    () => {
      runD1(`INSERT INTO performance_plans (performance_plan_id, performance_id, source_ref_id, posted_at, observed_at, is_current) VALUES ('old-plan', 'performance-1', 'attachment', '2026-10-01', '2026-10-01', 1);
      INSERT INTO practice_plans (practice_plan_id, practice_id, source_ref_id, posted_at, observed_at, is_current) VALUES ('practice-plan', 'sheet-practice', 'attachment', '2026-10-01', '2026-10-01', 1);
      UPDATE practice_items SET practice_plan_id = 'practice-plan' WHERE practice_item_id = 'song';
      UPDATE performance_assignments SET performance_plan_id = 'old-plan' WHERE assignment_id = 'assignment-1';`);
      expect(() =>
        runD1(
          "INSERT INTO performance_plans VALUES ('duplicate', 'performance-1', 'attachment', '2026-10-02', '2026-10-02', 1)",
        ),
      ).toThrow();
      expect(() =>
        runD1(
          "INSERT INTO practice_plans VALUES ('duplicate', 'sheet-practice', 'attachment', '2026-10-02', '2026-10-02', 1)",
        ),
      ).toThrow();
      runD1(`DELETE FROM performance_assignments WHERE performance_plan_id = 'old-plan';
      UPDATE performance_plans SET is_current = 0 WHERE performance_plan_id = 'old-plan';
      INSERT INTO performance_plans VALUES ('new-plan', 'performance-1', 'attachment', '2026-10-02', '2026-10-02', 1);`);
      expect(
        runD1(
          "SELECT performance_plan_id FROM performance_plans WHERE is_current = 1",
        ).results,
      ).toEqual([{ performance_plan_id: "new-plan" }]);
      expect(
        runD1(
          "SELECT assignment_id FROM performance_assignments WHERE performance_plan_id = 'old-plan'",
        ).results,
      ).toEqual([]);
    },
    D1_TEST_TIMEOUT_MS,
  );

  it("represents current performance fields, independent confirmations and fact provenance", () => {
    runD1(`UPDATE performances SET event_date = '2026-11-02', venue = 'Hall', call_at = '2026-11-02T17:00:00Z', performance_at = '2026-11-02T18:00:00Z' WHERE performance_id = 'performance-1';
      INSERT INTO performance_performers (performance_id, performer_name, source_ref_id) VALUES ('performance-1', 'Mika', 'source-1');
      INSERT INTO performance_repertoire (repertoire_item_id, performance_id, sequence_number, song_title, source_ref_id) VALUES ('set-song', 'performance-1', 1, 'Festival Song', 'attachment');
      INSERT INTO performance_notes (performance_note_id, performance_id, note_kind, summary, source_ref_id) VALUES ('equipment', 'performance-1', 'equipment', 'Bring covers', 'source-1'), ('logistics', 'performance-1', 'logistics', 'Use side entrance', 'source-1'), ('misc', 'performance-1', 'misc', 'Thank host', 'source-1');
      INSERT INTO performance_field_sources (performance_id, field_name, source_ref_id) VALUES ('performance-1', 'venue', 'source-1'), ('performance-1', 'venue', 'attachment');`);
    expect(
      runD1(
        "SELECT source_ref_id FROM performance_field_sources WHERE field_name = 'venue' ORDER BY source_ref_id",
      ).results,
    ).toHaveLength(2);
    expect(() =>
      runD1(
        "INSERT INTO performance_field_sources VALUES ('performance-1', 'unknown', 'source-1')",
      ),
    ).toThrow();
  });

  it(
    "enforces all instrument colors and permits non-playing responsibilities",
    () => {
      const colored = [
        "beta_nagado",
        "seated_nagado",
        "naname_nagado",
        "shime",
      ];
      const uncolored = [
        "oodaiko",
        "fue",
        "chanchiki",
        "tachi_okedo",
        "yagura_oodaiko",
        "chappa",
        "okedo",
      ];
      const insert = (
        id: string,
        instrument: string,
        color: string,
        responsibility = "NULL",
      ): string =>
        `INSERT INTO performance_assignments (assignment_id, performance_id, performer_name, instrument, instrument_color, responsibility, source_ref_id, created_at, performance_plan_id) VALUES ('${id}', 'performance-1', 'Aiko', ${instrument}, ${color}, ${responsibility}, 'attachment', '2026-10-01', 'new-plan')`;
      runD1(
        [
          ...colored.map((instrument) =>
            insert(instrument, `'${instrument}'`, "'red'"),
          ),
          ...uncolored.map((instrument) =>
            insert(instrument, `'${instrument}'`, "NULL"),
          ),
          insert("speaker", "NULL", "NULL", "'Introduce songs'"),
        ].join(";"),
      );
      for (const instrument of colored) {
        expect(() =>
          runD1(insert("invalid", `'${instrument}'`, "NULL")),
        ).toThrow();
      }
      for (const instrument of uncolored) {
        expect(() =>
          runD1(insert("invalid", `'${instrument}'`, "'red'")),
        ).toThrow();
      }
      expect(() => runD1(insert("invalid", "NULL", "NULL"))).toThrow();
      expect(() => runD1(insert("invalid", "'piano'", "NULL"))).toThrow();
    },
    D1_TEST_TIMEOUT_MS,
  );

  it("enforces plan ownership and cascades plan-derived rows as a unit", () => {
    runD1(`INSERT INTO performances (performance_id, discord_channel_id, title, status, source_ref_id, created_at) VALUES ('other-performance', 'post', 'Another event', 'active', 'source-1', '2026-10-01');
      INSERT INTO practices (practice_id, scheduled_at, status, source_ref_id, created_at) VALUES ('other-practice', '2026-11-02', 'planned', 'sheet', '2026-10-01');`);
    expect(() =>
      runD1(
        "UPDATE performance_assignments SET performance_id = 'other-performance' WHERE performance_plan_id = 'new-plan'",
      ),
    ).toThrow();
    expect(() =>
      runD1(
        "UPDATE practice_items SET practice_id = 'other-practice' WHERE practice_plan_id = 'practice-plan'",
      ),
    ).toThrow();
    runD1(
      "DELETE FROM performance_plans WHERE performance_plan_id = 'new-plan'; DELETE FROM practice_plans WHERE practice_plan_id = 'practice-plan'",
    );
    expect(
      runD1(
        "SELECT assignment_id FROM performance_assignments WHERE performance_plan_id = 'new-plan'",
      ).results,
    ).toEqual([]);
    expect(
      runD1(
        "SELECT practice_item_id FROM practice_items WHERE practice_plan_id = 'practice-plan'",
      ).results,
    ).toEqual([]);
  });

  it("has no raw-content, binary-source or voter identity storage anywhere", () => {
    const tables = runD1(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%'",
    ).results.map((row) => String(row.name));
    const results = runD1Queries(
      tables.map((table) => `PRAGMA table_info('${table}')`).join(";"),
    );
    expect(tables).toHaveLength(TABLE_NAMES.length);
    expect(results).toHaveLength(TABLE_NAMES.length);
    expect(results.every((result) => result.results.length > 0)).toBe(true);
    for (const table of tables) {
      expect(table).not.toMatch(/voter|individual_vote/);
    }
    for (const column of results.flatMap((result) => result.results)) {
      expect(String(column.name)).not.toMatch(
        /raw|body|source_content|document_content|page_content|attachment_bytes|content_bytes|voter|vote_user|^(content|text|bytes|blob)$/i,
      );
      expect(column.type).not.toBe("BLOB");
    }
    expect(runD1("PRAGMA foreign_key_check").results).toEqual([]);
  });

  it("exposes the configured D1 binding through the database boundary", () => {
    const database = {} as D1Database;
    expect(getDatabase({ DB: database })).toBe(database);
  });
});
