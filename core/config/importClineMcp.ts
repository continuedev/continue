import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ConfigYaml } from "@continuedev/config-yaml";
import * as YAML from "yaml";

import type { IDE } from "..";
import { mcpRuleName } from "../tools/permissions/names";
import { getConfigYamlPath } from "../util/paths";
import { envFileHasValue, ensureSecretPlaceholder } from "../util/secretsFile";
import { isValidSecretName } from "../util/unresolvedSecrets";

import { SecretStorageKind, storeSecret } from "./secretStorage";

/*
  Import MCP servers from Cline (and Roo Code, which keeps the same format) into
  config.yaml, so servers do not have to be configured twice.

  Secret values (env vars and headers that look like credentials) are never
  written to config.yaml. They become `${{ secrets.NAME }}` references and the
  values go to the secret store. The values also never reach the webview: the
  preview lists only names, and the import re-reads the file in core.
*/

export type McpImportSourceKind = "cline" | "roo";

export interface McpImportSource {
  kind: McpImportSourceKind;
  label: string;
  path: string;
}

export interface SettingsEnv {
  platform: NodeJS.Platform;
  home: string;
  /** %APPDATA% on Windows */
  appData?: string;
}

export function currentSettingsEnv(): SettingsEnv {
  return {
    platform: process.platform,
    home: os.homedir(),
    appData: process.env.APPDATA,
  };
}

const EDITORS = ["Code", "Code - Insiders", "VSCodium", "Cursor", "Windsurf"];

/** Where VS Code-family editors keep extension globalStorage on this OS. */
function userDataDirs(env: SettingsEnv): { editor: string; dir: string }[] {
  return EDITORS.map((editor) => {
    switch (env.platform) {
      case "darwin":
        return {
          editor,
          dir: path.join(env.home, "Library", "Application Support", editor),
        };
      case "win32":
        return {
          editor,
          dir: path.join(
            env.appData ?? path.join(env.home, "AppData", "Roaming"),
            editor,
          ),
        };
      default:
        return { editor, dir: path.join(env.home, ".config", editor) };
    }
  });
}

/**
 * Every place the settings file could be. Cline: `cline_mcp_settings.json` in
 * the globalStorage of `saoudrizwan.claude-dev`. Roo Code
 * (`rooveterinaryinc.roo-cline`) uses the same format; newer versions name the
 * file `mcp_settings.json`.
 */
export function candidateSettingsPaths(env: SettingsEnv): McpImportSource[] {
  const out: McpImportSource[] = [];
  for (const { editor, dir } of userDataDirs(env)) {
    const storage = path.join(dir, "User", "globalStorage");
    out.push({
      kind: "cline",
      label: `Cline (${editor})`,
      path: path.join(
        storage,
        "saoudrizwan.claude-dev",
        "settings",
        "cline_mcp_settings.json",
      ),
    });
    for (const file of ["mcp_settings.json", "cline_mcp_settings.json"]) {
      out.push({
        kind: "roo",
        label: `Roo Code (${editor})`,
        path: path.join(
          storage,
          "rooveterinaryinc.roo-cline",
          "settings",
          file,
        ),
      });
    }
  }
  // Cline's standalone CLI
  out.push({
    kind: "cline",
    label: "Cline (CLI)",
    path: path.join(
      env.home,
      ".cline",
      "data",
      "settings",
      "cline_mcp_settings.json",
    ),
  });
  return out;
}

/** The candidate files that exist. */
export function findSettingsFiles(
  env: SettingsEnv = currentSettingsEnv(),
  exists: (p: string) => boolean = fs.existsSync,
): McpImportSource[] {
  return candidateSettingsPaths(env).filter((s) => exists(s.path));
}

// ---------------------------------------------------------------------------
// Conversion

export type McpTransport = "stdio" | "sse" | "streamable-http";

export interface PendingSecret {
  name: string;
  value: string;
}

export interface ConvertedServer {
  name: string;
  transport: McpTransport;
  /** Entry for `mcpServers`, with secrets already replaced by references. */
  yaml: Record<string, unknown>;
  secrets: PendingSecret[];
  /** `toolPermissions.allow` rules from Cline's alwaysAllow / autoApprove. */
  allowRules: string[];
}

export type SkipReason =
  "duplicate" | "disabled" | "invalid" | "unsupported-transport";

export interface SkippedServer {
  name: string;
  reason: SkipReason;
  detail?: string;
}

const SECRET_KEY =
  /key|token|secret|passw|credential|auth|bearer|cookie|session/i;
const SECRET_VALUE =
  /^(ghp_|gho_|github_pat_|sk-|xox[abprs]-|AKIA|AIza|glpat-)/;
const TEMPLATE = /\$\{/;

function isSecretLike(key: string, value: string): boolean {
  if (value === "" || TEMPLATE.test(value)) return false;
  return SECRET_KEY.test(key) || SECRET_VALUE.test(value);
}

function sanitizeNamePart(s: string): string {
  return s
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

/** `<SERVER>_<KEY>`, without repeating the server name when the key has it. */
function secretNameFor(server: string, key: string, taken: Set<string>) {
  const s = sanitizeNamePart(server);
  const k = sanitizeNamePart(key);
  let base = k.startsWith(`${s}_`) || !s ? k : `${s}_${k}`;
  if (!base) base = "MCP_SECRET";
  if (/^[0-9]/.test(base)) base = `MCP_${base}`;
  let name = base;
  for (let i = 2; taken.has(name); i++) name = `${base}_${i}`;
  taken.add(name);
  return name;
}

const ref = (name: string) => `\${{ secrets.${name} }}`;

function stringRecord(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string") out[k] = val;
    else if (typeof val === "number" || typeof val === "boolean")
      out[k] = String(val);
  }
  return Object.keys(out).length ? out : undefined;
}

function transportOf(entry: Record<string, any>): McpTransport | undefined {
  const type = typeof entry.type === "string" ? entry.type.toLowerCase() : "";
  if (type === "sse") return "sse";
  if (["streamable-http", "streamablehttp", "http"].includes(type)) {
    return "streamable-http";
  }
  if (type === "stdio") return "stdio";
  if (type) return undefined;
  if (typeof entry.command === "string") return "stdio";
  if (typeof entry.url === "string") return "sse";
  return undefined;
}

/** Convert one Cline / Roo server entry. Never throws. */
export function convertServer(
  name: string,
  entry: unknown,
  takenSecretNames: Set<string> = new Set(),
): ConvertedServer | SkippedServer {
  if (!name.trim() || !entry || typeof entry !== "object") {
    return { name, reason: "invalid", detail: "not an object" };
  }
  const e = entry as Record<string, any>;
  if (e.disabled === true) {
    return { name, reason: "disabled" };
  }
  const transport = transportOf(e);
  if (!transport) {
    return {
      name,
      reason: "unsupported-transport",
      detail: `type ${JSON.stringify(e.type)}`,
    };
  }

  const secrets: PendingSecret[] = [];
  const addSecret = (key: string, value: string) => {
    const secretName = secretNameFor(name, key, takenSecretNames);
    secrets.push({ name: secretName, value });
    return secretName;
  };

  const yaml: Record<string, unknown> = { name };

  if (transport === "stdio") {
    if (typeof e.command !== "string" || !e.command.trim()) {
      return { name, reason: "invalid", detail: "missing command" };
    }
    yaml.command = e.command;
    if (Array.isArray(e.args)) {
      const args = e.args.filter((a: unknown) => typeof a === "string");
      if (args.length) yaml.args = args;
    }
    const env = stringRecord(e.env);
    if (env) {
      yaml.env = Object.fromEntries(
        Object.entries(env).map(([k, v]) => [
          k,
          isSecretLike(k, v) ? ref(addSecret(k, v)) : v,
        ]),
      );
    }
    if (typeof e.cwd === "string" && e.cwd) yaml.cwd = e.cwd;
  } else {
    if (typeof e.url !== "string" || !e.url.trim()) {
      return { name, reason: "invalid", detail: "missing url" };
    }
    // Credentials in the query string, such as ?api_key=...
    yaml.url = e.url.replace(
      /([?&])([^=&#]*(?:key|token|secret|auth|passw)[^=&#]*)=([^&#]+)/gi,
      (m, sep: string, key: string, value: string) =>
        TEMPLATE.test(value) ? m : `${sep}${key}=${ref(addSecret(key, value))}`,
    );
    yaml.type = transport;
    const headers = stringRecord(e.headers);
    if (headers) {
      const converted: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        if (!isSecretLike(k, v)) {
          converted[k] = v;
          continue;
        }
        // Keep the scheme (Bearer, Basic) in the file; only the token is secret
        const scheme = /^(Bearer|Basic|Token)\s+(\S.*)$/i.exec(v);
        converted[k] = scheme
          ? `${scheme[1]} ${ref(addSecret(k, scheme[2]))}`
          : ref(addSecret(k, v));
      }
      yaml.requestOptions = { headers: converted };
    }
  }

  // Cline's timeout is in seconds, ours is milliseconds
  if (typeof e.timeout === "number" && e.timeout > 0) {
    yaml.connectionTimeout = Math.round(e.timeout * 1000);
  }

  const allowed = [e.alwaysAllow, e.autoApprove]
    .filter(Array.isArray)
    .flat()
    .filter((t: unknown): t is string => typeof t === "string" && !!t);
  const allowRules = [...new Set(allowed)].map((tool) =>
    mcpRuleName(name, tool),
  );

  return { name, transport, yaml, secrets, allowRules };
}

export function isSkipped(
  r: ConvertedServer | SkippedServer,
): r is SkippedServer {
  return "reason" in r;
}

/** Parse a settings file and convert every server, marking duplicates. */
export function convertSettings(
  text: string,
  existingNames: Iterable<string>,
): { servers: ConvertedServer[]; skipped: SkippedServer[]; error?: string } {
  let json: any;
  try {
    json = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    return { servers: [], skipped: [], error: "The file is not valid JSON" };
  }
  const entries = json?.mcpServers;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    return { servers: [], skipped: [], error: "The file has no mcpServers" };
  }

  const seen = new Set([...existingNames].map((n) => n.trim().toLowerCase()));
  const takenSecretNames = new Set<string>();
  const servers: ConvertedServer[] = [];
  const skipped: SkippedServer[] = [];
  for (const [name, entry] of Object.entries(entries)) {
    if (seen.has(name.trim().toLowerCase())) {
      skipped.push({ name, reason: "duplicate" });
      continue;
    }
    const result = convertServer(name, entry, takenSecretNames);
    if (isSkipped(result)) {
      skipped.push(result);
    } else {
      seen.add(name.trim().toLowerCase());
      servers.push(result);
    }
  }
  return { servers, skipped };
}

// ---------------------------------------------------------------------------
// Preview (safe to send to the webview: no secret values)

export interface McpImportPreviewServer {
  name: string;
  transport?: McpTransport;
  status: "new" | SkipReason;
  detail?: string;
  /** Names of the secrets that would be created */
  secretNames: string[];
  allowedToolCount: number;
}

export interface McpImportPreviewSource extends McpImportSource {
  servers: McpImportPreviewServer[];
  error?: string;
}

export interface McpImportPreview {
  sources: McpImportPreviewSource[];
}

export function existingMcpServerNames(config: ConfigYaml | undefined) {
  return (config?.mcpServers ?? [])
    .map((s) => (s && typeof s === "object" && "name" in s ? s.name : ""))
    .filter((n): n is string => typeof n === "string" && n !== "");
}

/** The global config.yaml, or undefined when there is none or it does not parse. */
export function readGlobalConfigYaml(): ConfigYaml | undefined {
  try {
    const file = getConfigYamlPath();
    if (!fs.existsSync(file)) return undefined;
    const parsed = YAML.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : ({} as ConfigYaml);
  } catch {
    return undefined;
  }
}

export function previewImport(
  sources: McpImportSource[],
  existingNames: string[],
  readText: (p: string) => string = (p) => fs.readFileSync(p, "utf8"),
): McpImportPreview {
  return {
    sources: sources.map((source) => {
      let text: string;
      try {
        text = readText(source.path);
      } catch {
        return { ...source, servers: [], error: "Could not read the file" };
      }
      const { servers, skipped, error } = convertSettings(text, existingNames);
      return {
        ...source,
        error,
        servers: [
          ...servers.map((s): McpImportPreviewServer => ({
            name: s.name,
            transport: s.transport,
            status: "new",
            secretNames: s.secrets.map((x) => x.name),
            allowedToolCount: s.allowRules.length,
          })),
          ...skipped.map((s): McpImportPreviewServer => ({
            name: s.name,
            status: s.reason,
            detail: s.detail,
            secretNames: [],
            allowedToolCount: 0,
          })),
        ],
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Import

/** Add servers and allow rules to a config; entries already there are kept. */
export function applyServers(
  config: ConfigYaml,
  servers: ConvertedServer[],
): ConfigYaml {
  const have = new Set(
    existingMcpServerNames(config).map((n) => n.trim().toLowerCase()),
  );
  const fresh = servers.filter((s) => !have.has(s.name.trim().toLowerCase()));
  if (fresh.length === 0) return config;

  const next: ConfigYaml = {
    ...config,
    mcpServers: [
      ...(config.mcpServers ?? []),
      ...fresh.map((s) => s.yaml as any),
    ],
  };
  const rules = fresh.flatMap((s) => s.allowRules);
  if (rules.length) {
    const current = config.toolPermissions ?? {};
    const allow = current.allow ?? [];
    const added = rules.filter((r) => !allow.includes(r));
    if (added.length) {
      next.toolPermissions = { ...current, allow: [...allow, ...added] };
    }
  }
  return next;
}

export interface McpImportRequest {
  /** Must be one of the detected settings files */
  sourcePath: string;
  /** Servers to import; the names shown in the preview */
  names: string[];
  /** Store the secret values; if false the references are written empty */
  storeSecrets: boolean;
  storage: SecretStorageKind;
}

export interface McpImportResult {
  imported: string[];
  skipped: SkippedServer[];
  secretsStored: string[];
  /** Referenced but without a value; the user has to set them */
  secretsPending: string[];
  warnings: string[];
  error?: string;
}

export interface McpImportDeps {
  ide: Pick<IDE, "readSecrets" | "writeSecrets">;
  /** ~/.continue */
  continueDir: string;
  sources: McpImportSource[];
  readText?: (p: string) => string;
  readConfig: () => ConfigYaml | undefined;
  /** Edit config.yaml in place with comments kept; false if there is none. */
  editConfig: (cb: (c: ConfigYaml) => ConfigYaml) => boolean;
}

export async function importMcpServers(
  req: McpImportRequest,
  deps: McpImportDeps,
): Promise<McpImportResult> {
  const result: McpImportResult = {
    imported: [],
    skipped: [],
    secretsStored: [],
    secretsPending: [],
    warnings: [],
  };
  const fail = (error: string) => ({ ...result, error });

  const source = deps.sources.find((s) => s.path === req.sourcePath);
  if (!source) return fail("That is not a settings file we found");

  const config = deps.readConfig();
  if (!config) return fail("There is no config.yaml to add the servers to");

  let text: string;
  try {
    text = (deps.readText ?? ((p) => fs.readFileSync(p, "utf8")))(source.path);
  } catch {
    return fail("Could not read the settings file");
  }
  const converted = convertSettings(text, existingMcpServerNames(config));
  if (converted.error) return fail(converted.error);
  result.skipped = converted.skipped;

  const wanted = new Set(req.names);
  const servers = converted.servers.filter((s) => wanted.has(s.name));
  if (servers.length === 0) return fail("No servers to import");

  // Secrets first, so a failure to store never leaves a server pointing at
  // a value we meant to save.
  for (const { name, value } of servers.flatMap((s) => s.secrets)) {
    if (!isValidSecretName(name)) {
      result.secretsPending.push(name);
      continue;
    }
    if (!req.storeSecrets) {
      result.secretsPending.push(name);
      continue;
    }
    let existing = envFileHasValue(deps.continueDir, name);
    if (!existing) {
      try {
        existing = !!(await deps.ide.readSecrets([name]))?.[name];
      } catch {
        // treat as absent
      }
    }
    if (existing) {
      result.warnings.push(
        `${name} already has a value, so it was kept and not overwritten.`,
      );
      continue;
    }
    const stored = await storeSecret({
      ide: deps.ide,
      name,
      value,
      storage: req.storage,
      continueDir: deps.continueDir,
    });
    if (stored.stored) {
      result.secretsStored.push(name);
      if (stored.envShadowed) {
        result.warnings.push(
          `${name} is now in secure storage; ~/.continue/.env still has an unused copy you can remove.`,
        );
      }
    } else {
      result.secretsPending.push(name);
      result.warnings.push(`${name} was not stored: ${stored.error}`);
    }
  }

  // Make pending names easy to fill in: an empty NAME= line in ~/.continue/.env
  for (const name of result.secretsPending) {
    try {
      ensureSecretPlaceholder(deps.continueDir, name);
    } catch {
      // not fatal
    }
  }

  const edited = deps.editConfig((c) => applyServers(c, servers));
  if (!edited) return fail("There is no config.yaml to add the servers to");
  result.imported = servers.map((s) => s.name);
  return result;
}
