// Shared helper for building safe PostgREST `.or()` ilike filters from raw
// user search input. PostgREST's `.or()` filter string uses `,` to separate
// conditions and `()` to group them, and SQL's ILIKE treats `%`/`_` as
// wildcards — a raw, unescaped user term containing any of those used to
// corrupt the filter grammar or produce overly-broad matches (this was the
// root cause of "search returns nothing" for queries like "Widget (Blue)").
// Wrapping the value in double quotes is PostgREST's own escape hatch for
// filter metacharacters; within a quoted value only `\` and `"` need
// escaping, and `%`/`_` are escaped separately so they match literally
// under Postgres's default LIKE/ILIKE backslash-escape behavior.
export function escapeIlikeTerm(raw: string): string {
  return raw
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/"/g, '\\"');
}

export function orIlike(columns: string[], term: string): string {
  const escaped = escapeIlikeTerm(term);
  return columns.map((col) => `${col}.ilike."%${escaped}%"`).join(",");
}
