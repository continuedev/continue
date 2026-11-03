import fs from "node:fs";
import path from "node:path";

import { isValidSecretName } from "./unresolvedSecrets";

/**
 * Make sure `<dir>/.env` exists and has a `NAME=` line for the secret, so the
 * user can open the file and just type the value. An existing value is never
 * touched. Returns the path of the file.
 */
export function ensureSecretPlaceholder(dir: string, name: string): string {
  if (!isValidSecretName(name)) {
    throw new Error(`"${name}" is not a valid secret name`);
  }

  const file = path.join(dir, ".env");
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";

  const alreadyListed = existing
    .split(/\r?\n/)
    .some((line) => new RegExp(`^\\s*(export\\s+)?${name}\\s*=`).test(line));

  if (!alreadyListed) {
    const separator = existing === "" || existing.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(file, `${existing}${separator}${name}=\n`, {
      mode: 0o600,
    });
  }

  return file;
}
