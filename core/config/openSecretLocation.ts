import type { IDE } from "..";
import { localPathToUri } from "../util/pathToUri";
import { ensureSecretPlaceholder } from "../util/secretsFile";
import { isValidSecretName } from "../util/unresolvedSecrets";

export type SecretLocationTarget = "env" | "configLine";

/** Line (0-based) of the first `${{ secrets.NAME }}` reference, or -1. */
export function findSecretLine(text: string, secretName: string): number {
  const reference = new RegExp(
    `\\$\\{\\{\\s*secrets\\.(?:[^}\\s]*/)?${secretName}\\s*\\}\\}`,
  );
  return text.split(/\r?\n/).findIndex((line) => reference.test(line));
}

/**
 * Take the user to the place where a missing secret must be set.
 *
 * - "env": open ~/.continuous/.env, adding an empty `NAME=` line first.
 * - "configLine": open the config file at the line that uses the secret. Only
 *   the main config file is searched; a secret used from another block file
 *   falls back to opening the config file.
 */
export async function openSecretLocation(args: {
  ide: Pick<IDE, "openFile" | "readFile" | "showLines">;
  secretName: string;
  target: SecretLocationTarget;
  continueDir: string;
  /** URI of the config file the secret is used from. */
  configUri?: string;
}): Promise<void> {
  const { ide, secretName, target, continueDir, configUri } = args;

  if (!isValidSecretName(secretName)) {
    throw new Error(`"${secretName}" is not a valid secret name`);
  }

  if (target === "env") {
    const file = ensureSecretPlaceholder(continueDir, secretName);
    await ide.openFile(localPathToUri(file));
    return;
  }

  if (!configUri) {
    return;
  }
  const line = findSecretLine(await ide.readFile(configUri), secretName);
  if (line >= 0) {
    await ide.showLines(configUri, line, line + 1);
  } else {
    await ide.openFile(configUri);
  }
}
