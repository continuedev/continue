import fs from "node:fs";
import path from "node:path";

import * as dotenv from "dotenv";

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

/**
 * Format a value for a .env file so `dotenv.parse` reads back the same text.
 * Throws for values .env cannot hold (line breaks, or all three quote kinds).
 * The value is never included in an error message.
 */
export function formatEnvValue(value: string): string {
  if (/[\r\n]/.test(value)) {
    throw new Error("A secret value cannot contain line breaks");
  }
  if (value === "") return "";
  if (/^[A-Za-z0-9_.:/+=@%,-]+$/.test(value)) return value;
  for (const quote of ["'", '"', "`"]) {
    if (!value.includes(quote)) return `${quote}${value}${quote}`;
  }
  throw new Error("This secret value cannot be stored in a .env file");
}

/**
 * Set `NAME=value` in `<dir>/.env`: replaces the line for NAME if there is
 * one, otherwise appends it. Other lines, comments and order are kept. The file
 * is created (and kept) readable by the owner only. Returns the file path.
 */
export function setSecretInEnvFile(
  dir: string,
  name: string,
  value: string,
): string {
  if (!isValidSecretName(name)) {
    throw new Error(`"${name}" is not a valid secret name`);
  }
  const formatted = formatEnvValue(value);

  const file = path.join(dir, ".env");
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const eol = existing.includes("\r\n") ? "\r\n" : "\n";
  const lines = existing === "" ? [] : existing.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const assignment = new RegExp(`^\\s*(export\\s+)?${name}\\s*=`);
  const line = `${name}=${formatted}`;
  const index = lines.findIndex((l) => assignment.test(l));
  if (index >= 0) lines[index] = line;
  else lines.push(line);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, lines.join(eol) + eol, { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Not supported on every file system (Windows); the write above succeeded.
  }
  return file;
}

/** True when `<dir>/.env` already has a non-empty value for the secret. */
export function envFileHasValue(dir: string, name: string): boolean {
  try {
    const file = path.join(dir, ".env");
    if (!fs.existsSync(file)) return false;
    return !!dotenv.parse(fs.readFileSync(file, "utf8"))[name];
  } catch {
    return false;
  }
}

/** The value `<dir>/.env` holds for the secret, if any. Callers must not log it. */
export function readSecretFromEnvFile(
  dir: string,
  name: string,
): string | undefined {
  try {
    const file = path.join(dir, ".env");
    if (!fs.existsSync(file)) return undefined;
    const value = dotenv.parse(fs.readFileSync(file, "utf8"))[name];
    return value ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Remove the line that sets `NAME` from `<dir>/.env`, leaving every other line,
 * comment and the line endings alone. Returns false when there was no such
 * line. Throws, without touching the file, when removing the line would change
 * any other variable (for example a quoted value that spans several lines).
 */
export function removeSecretFromEnvFile(dir: string, name: string): boolean {
  if (!isValidSecretName(name)) {
    throw new Error(`"${name}" is not a valid secret name`);
  }
  const file = path.join(dir, ".env");
  if (!fs.existsSync(file)) return false;
  const existing = fs.readFileSync(file, "utf8");
  const eol = existing.includes("\r\n") ? "\r\n" : "\n";
  const lines = existing.split(/\r?\n/);
  const assignment = new RegExp(`^\\s*(export\\s+)?${name}\\s*=`);
  const kept = lines.filter((l) => !assignment.test(l));
  if (kept.length === lines.length) return false;

  const next = kept.join(eol);
  const before = dotenv.parse(existing);
  const after = dotenv.parse(next);
  delete before[name];
  const same =
    Object.keys(before).length === Object.keys(after).length &&
    Object.keys(before).every((k) => before[k] === after[k]);
  if (!same || name in after) {
    throw new Error(
      `Could not remove ${name} from .env without changing other lines; edit the file by hand`,
    );
  }
  fs.writeFileSync(file, next, { mode: 0o600 });
  return true;
}
