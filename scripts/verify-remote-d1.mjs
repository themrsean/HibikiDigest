import { execFileSync } from "node:child_process";

const DATABASE_BINDING = "DB";
const EXPECTED_PRODUCT_TABLE_COUNT = 23;
const MIGRATIONS = [
  "0001_initial_schema.sql",
  "0002_requirement_alignment.sql",
];
const EXPECTED_TABLES = [
  "audit_checkpoint",
  "audit_lock",
  "audit_runs",
  "audit_source_errors",
  "discord_categories",
  "discord_channels",
  "message_observations",
  "performance_assignments",
  "performance_field_sources",
  "performance_notes",
  "performance_performers",
  "performance_plans",
  "performance_repertoire",
  "performances",
  "poll_options",
  "polls",
  "practice_absences",
  "practice_items",
  "practice_plans",
  "practices",
  "questions",
  "reported_items",
  "source_refs",
];
const EXPECTED_COLUMNS = {
  audit_runs: ["audit_mode", "initiator_identity"],
  discord_channels: ["structural_type"],
  message_observations: ["content_hash", "is_pinned"],
  practices: ["location"],
  questions: ["last_activity_at"],
  source_refs: ["external_url"],
};
const EXPECTED_INDEXES = [
  "audit_runs_mode_status_completed_idx",
  "performance_plans_current_unique",
  "practice_plans_current_unique",
  "questions_status_activity_idx",
  "source_refs_discord_message_unique",
];
const SCHEMA_QUERY =
  "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY type, name";
const MIGRATION_QUERY = "SELECT name FROM d1_migrations ORDER BY name";
const FOREIGN_KEY_QUERY = "PRAGMA foreign_key_check";

function executeD1(sql, location) {
  const output = execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      DATABASE_BINDING,
      location,
      "--json",
      "--command",
      sql,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  return JSON.parse(output);
}

function resultRows(response) {
  return response.flatMap((statement) => statement.results ?? []);
}

function productSchema(rows) {
  return rows
    .filter(
      (row) => !row.name.startsWith("_cf_") && row.name !== "d1_migrations",
    )
    .map((row) => ({
      ...row,
      sql: row.sql?.replaceAll(/\s+/g, " ").trim() ?? null,
    }));
}

function assertEqual(actual, expected, description) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${description}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`,
    );
  }
}

function verifyColumns(schemaRows) {
  for (const [tableName, requiredColumns] of Object.entries(EXPECTED_COLUMNS)) {
    const table = schemaRows.find(
      (row) => row.type === "table" && row.name === tableName,
    );
    if (
      !table ||
      requiredColumns.some(
        (column) => !new RegExp(`\\b${column}\\b`).test(table.sql),
      )
    ) {
      throw new Error(
        `Expected columns are missing from ${tableName}: ${requiredColumns.join(", ")}`,
      );
    }
  }
}

function main() {
  const localSchema = productSchema(
    resultRows(executeD1(SCHEMA_QUERY, "--local")),
  );
  const remoteSchema = productSchema(
    resultRows(executeD1(SCHEMA_QUERY, "--remote")),
  );
  const remoteTables = remoteSchema
    .filter((row) => row.type === "table")
    .map((row) => row.name)
    .sort();
  const remoteIndexes = remoteSchema
    .filter((row) => row.type === "index")
    .map((row) => row.name);
  const remoteMigrations = resultRows(
    executeD1(MIGRATION_QUERY, "--remote"),
  ).map((row) => row.name);
  const foreignKeyViolations = resultRows(
    executeD1(FOREIGN_KEY_QUERY, "--remote"),
  );

  assertEqual(
    remoteTables,
    [...EXPECTED_TABLES].sort(),
    "Remote product tables do not match the expected schema.",
  );
  assertEqual(
    remoteTables.length,
    EXPECTED_PRODUCT_TABLE_COUNT,
    "Remote product table count is incorrect.",
  );
  assertEqual(
    remoteSchema,
    localSchema,
    "Remote product schema differs from the local migrated schema.",
  );
  assertEqual(
    MIGRATIONS.filter((name) => remoteMigrations.includes(name)),
    MIGRATIONS,
    "Remote migration ledger is incomplete.",
  );
  assertEqual(
    EXPECTED_INDEXES.filter((name) => remoteIndexes.includes(name)),
    EXPECTED_INDEXES,
    "Expected remote indexes are missing.",
  );
  assertEqual(
    foreignKeyViolations,
    [],
    "Remote foreign-key integrity check found violations.",
  );
  verifyColumns(remoteSchema);
}

main();
