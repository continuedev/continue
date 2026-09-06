/**
 * Escape a value for use inside a single-quoted LanceDB SQL string literal.
 * LanceDB / SQL standard escaping doubles single quotes.
 */
export function escapeLanceSqlString(value: string): string {
  return value.replace(/'/g, "''");
}
