export interface DatabaseBindings {
  DB: D1Database;
}

export function getDatabase(bindings: DatabaseBindings): D1Database {
  return bindings.DB;
}
