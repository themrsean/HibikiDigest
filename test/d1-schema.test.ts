import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
const D1_BINDING = "DB";
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
];
let localStateDirectory = "";

interface D1QueryResult {
  results: Array<Record<string, unknown>>;
}

function runD1(sql: string): D1QueryResult {
  const output = execFileSync(
    WRANGLER_EXECUTABLE,
    [
      "d1",
      "execute",
      D1_BINDING,
      "--local",
      "--persist-to",
      localStateDirectory,
      "--command",
      sql,
      "--json",
    ],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  );
  const results = JSON.parse(output) as D1QueryResult[];
  return results[0];
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

describe("local D1 schema", () => {
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

  it("stores traceability and normalized operational data without raw source content", () => {
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
      "INSERT INTO practice_absences (practice_id, member_discord_user_id, source_ref_id, created_at) VALUES ('practice-1', 'member-1', 'source-1', '2026-10-07T00:00:00Z')",
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
  }, 20_000);

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
  });

  it("exposes the configured D1 binding through the database boundary", () => {
    const database = {} as D1Database;
    expect(getDatabase({ DB: database })).toBe(database);
  });
});
