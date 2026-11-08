/**
 * Editor checks for Continuous's own YAML files (a config, models.yaml,
 * providers.yaml), with positions: what the JSON schema cannot say because
 * it spans files, such as a `from:` naming a model the catalog does not
 * have, or a `connection:` naming no account. Pure: the text and the other
 * files' names in, diagnostics out, so an editor (or a language server
 * later) only has to call it.
 */
import {
  catalogModelSchema,
  configYamlSchema,
  modelsFileSchema,
  providersFileSchema,
} from "@continuedev/config-yaml";
import {
  Document,
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  Node,
  parseDocument,
} from "yaml";
import type { z } from "zod";

export type ConfigFileKind = "config" | "models" | "providers";

/** What the other files define, for the cross-file checks. */
export interface ConfigFileContext {
  /** Catalog models (models.yaml), with their variant names. */
  models: { name: string; variants: string[] }[];
  /** Provider accounts (providers.yaml). */
  accounts: string[];
}

export interface ConfigFileDiagnostic {
  /** 0-based, end exclusive. */
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: "error" | "warning";
  message: string;
}

const CONFIG_DIRS = /(^|[\\/])\.continu(e|ous)[\\/]/;

/**
 * Which of our files this is, from its path: models.yaml and providers.yaml
 * in a .continuous (or .continue) folder, and any other YAML file there that
 * is a config (config.yaml, configs/, agents/, assistants/).
 */
export function configFileKind(
  path: string,
  /** The global folder, when it is not ~/.continuous (CONTINUOUS_GLOBAL_DIR). */
  globalDir?: string,
): ConfigFileKind | undefined {
  let normalized = decodeURIComponent(path)
    .replace(/^file:\/\//, "")
    .replace(/\\/g, "/");
  if (globalDir) {
    const dir = globalDir.replace(/\\/g, "/").replace(/\/$/, "");
    const lower = normalized.toLowerCase();
    const at = lower.indexOf(dir.toLowerCase() + "/");
    if (at >= 0 && !CONFIG_DIRS.test(dir + "/")) {
      normalized = "/.continuous/" + normalized.slice(at + dir.length + 1);
    }
  }
  if (!CONFIG_DIRS.test(normalized)) return undefined;
  if (!/\.ya?ml$/i.test(normalized)) return undefined;
  const base = normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
  if (base === "models.yaml" || base === "models.yml") return "models";
  if (base === "providers.yaml" || base === "providers.yml") return "providers";
  // Folders that hold other YAML (prompts, rules, MCP servers) are not configs
  if (
    /\/\.continu(e|ous)\/(prompts|rules|mcpServers|docs|plans|context|data)\//.test(
      normalized,
    )
  ) {
    return undefined;
  }
  if (/\/\.continu(e|ous)\/[^/]+$/.test(normalized)) {
    return base === "config.yaml" || base === "config.yml"
      ? "config"
      : undefined;
  }
  return "config";
}

interface Located {
  doc: Document.Parsed;
  lines: LineCounter;
}

function rangeOf(
  { lines }: Located,
  node: { range?: [number, number, number] | null } | null | undefined,
  fallback: [number, number] = [0, 0],
): ConfigFileDiagnostic["range"] {
  const [start, end] = node?.range ? [node.range[0], node.range[1]] : fallback;
  const a = lines.linePos(start);
  const b = lines.linePos(Math.max(end, start));
  return {
    start: { line: a.line - 1, character: a.col - 1 },
    end: { line: b.line - 1, character: b.col - 1 },
  };
}

/** The node at a path, or the deepest parent that exists. */
function nodeAt(doc: Document.Parsed, path: (string | number)[]): Node | null {
  for (let n = path.length; n >= 0; n--) {
    const node = doc.getIn(path.slice(0, n), true) as Node | undefined;
    if (node && typeof node === "object" && "range" in node) return node;
  }
  return null;
}

/** The node of a key in a map (for "missing" and "unknown key" problems). */
function keyAt(doc: Document.Parsed, path: (string | number)[]): Node | null {
  const parent = doc.getIn(path.slice(0, -1), true);
  if (!isMap(parent)) return null;
  const pair = parent.items.find(
    (p) => isScalar(p.key) && p.key.value === path[path.length - 1],
  );
  return (pair?.key as Node) ?? null;
}

function schemaFor(kind: ConfigFileKind): z.ZodType {
  if (kind === "models") return modelsFileSchema;
  if (kind === "providers") return providersFileSchema;
  return configYamlSchema;
}

function schemaProblems(
  located: Located,
  kind: ConfigFileKind,
  value: unknown,
): ConfigFileDiagnostic[] {
  const result = schemaFor(kind).safeParse(value ?? {});
  if (result.success) return [];
  const seen = new Set<string>();
  const out: ConfigFileDiagnostic[] = [];
  for (const issue of result.error.issues) {
    const path = issue.path as (string | number)[];
    // A union reports every branch that failed; one message per place is enough
    const key = path.join(".");
    if (seen.has(key)) continue;
    seen.add(key);
    const node =
      (issue.code === "unrecognized_keys" ? null : nodeAt(located.doc, path)) ??
      keyAt(located.doc, path) ??
      nodeAt(located.doc, path);
    const where = path.length ? `${path.join(".")}: ` : "";
    out.push({
      range: rangeOf(located, node),
      severity: "error",
      message: `${where}${issue.message}`,
    });
  }
  return out;
}

function stringItems(
  doc: Document.Parsed,
  listPath: string[],
): { index: number; item: Node }[] {
  const list = doc.getIn(listPath, true);
  if (!isSeq(list)) return [];
  return list.items.map((item, index) => ({ index, item: item as Node }));
}

function scalarAt(doc: Document.Parsed, path: (string | number)[]) {
  const node = doc.getIn(path, true);
  return isScalar(node) && typeof node.value === "string"
    ? { node, value: node.value }
    : undefined;
}

/** Up to three known names closest to `name`, for "did you mean". */
export function closest(name: string, known: string[]): string[] {
  const lower = name.toLowerCase();
  const score = (k: string) => {
    const kl = k.toLowerCase();
    if (kl.includes(lower) || lower.includes(kl)) return 0;
    // Levenshtein distance, small strings only
    const a = lower,
      b = kl;
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = row[j];
        row[j] = Math.min(
          row[j] + 1,
          row[j - 1] + 1,
          prev + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
        prev = tmp;
      }
    }
    return row[b.length];
  };
  return known
    .map((k) => ({ k, s: score(k) }))
    .filter(({ s }) => s <= Math.max(2, Math.floor(name.length / 3)))
    .sort((x, y) => x.s - y.s)
    .slice(0, 3)
    .map(({ k }) => k);
}

function suggestion(name: string, known: string[]) {
  const near = closest(name, known);
  return near.length
    ? ` Did you mean ${near.map((n) => `"${n}"`).join(" or ")}?`
    : "";
}

/** `Name` or `Name#variant` against the catalog: a problem, or undefined. */
function catalogRefProblem(
  ref: string,
  context: ConfigFileContext,
): string | undefined {
  const hash = ref.indexOf("#");
  const name = hash < 0 ? ref : ref.slice(0, hash);
  const variant = hash < 0 ? undefined : ref.slice(hash + 1);
  const model = context.models.find((m) => m.name === name);
  if (!model) {
    const known = context.models.map((m) => m.name);
    return known.length
      ? `No model named "${name}" in the catalog (models.yaml).${suggestion(name, known)}`
      : `No model named "${name}": the catalog (models.yaml) is empty or missing.`;
  }
  if (variant !== undefined && !model.variants.includes(variant)) {
    return model.variants.length
      ? `"${name}" has no variant "${variant}". Its variants: ${model.variants.join(", ")}.`
      : `"${name}" has no variants, so "#${variant}" picks nothing.`;
  }
  return undefined;
}

function accountProblem(name: string, context: ConfigFileContext) {
  if (context.accounts.includes(name)) return undefined;
  return context.accounts.length
    ? `No account named "${name}" in providers.yaml.${suggestion(name, context.accounts)}`
    : `No account named "${name}": providers.yaml has no accounts.`;
}

function duplicateNames(
  located: Located,
  listPath: string[],
  what: string,
): ConfigFileDiagnostic[] {
  const out: ConfigFileDiagnostic[] = [];
  const seen = new Set<string>();
  for (const { index } of stringItems(located.doc, listPath)) {
    const name = scalarAt(located.doc, [...listPath, index, "name"]);
    if (!name) continue;
    if (seen.has(name.value)) {
      out.push({
        range: rangeOf(located, name.node),
        severity: "warning",
        message: `Another ${what} is named "${name.value}" above; the first one is used.`,
      });
    }
    seen.add(name.value);
  }
  return out;
}

function connectionChecks(
  located: Located,
  modelPath: (string | number)[],
  context: ConfigFileContext,
): ConfigFileDiagnostic[] {
  const out: ConfigFileDiagnostic[] = [];
  const check = (path: (string | number)[]) => {
    const conn = scalarAt(located.doc, path);
    const problem = conn && accountProblem(conn.value, context);
    if (problem) {
      out.push({
        range: rangeOf(located, conn!.node),
        severity: "error",
        message: problem,
      });
    }
  };
  check([...modelPath, "connection"]);
  for (const { index } of stringItems(located.doc, [
    ...modelPath.map(String),
    "routes",
  ])) {
    check([...modelPath, "routes", index, "connection"]);
  }
  return out;
}

function checkConfig(located: Located, context: ConfigFileContext) {
  const { doc } = located;
  const out: ConfigFileDiagnostic[] = [];
  const configNames = new Set<string>();
  for (const { index } of stringItems(doc, ["models"])) {
    const from = scalarAt(doc, ["models", index, "from"]);
    const name = scalarAt(doc, ["models", index, "name"]);
    if (name) configNames.add(name.value);
    if (from) {
      configNames.add(from.value);
      const problem = catalogRefProblem(from.value, context);
      if (problem) {
        out.push({
          range: rangeOf(located, from.node),
          severity: "error",
          message: problem,
        });
      }
    } else {
      out.push(...connectionChecks(located, ["models", index], context));
    }
  }
  // modeModels may name a config model, a catalog model or a variant
  const modes = doc.get("modeModels", true);
  if (isMap(modes)) {
    for (const pair of modes.items) {
      if (!isScalar(pair.key)) continue;
      const ref = scalarAt(doc, [
        "modeModels",
        String(pair.key.value),
        "model",
      ]);
      if (!ref || configNames.has(ref.value)) continue;
      const problem = catalogRefProblem(ref.value, context);
      if (problem) {
        out.push({
          range: rangeOf(located, ref.node),
          severity: "warning",
          message: `This config has no model "${ref.value}", and the catalog cannot supply it: ${problem}`,
        });
      }
    }
  }
  return out;
}

function checkModels(located: Located, context: ConfigFileContext) {
  const { doc } = located;
  const out: ConfigFileDiagnostic[] = [];
  for (const { index } of stringItems(doc, ["models"])) {
    const name = scalarAt(doc, ["models", index, "name"]);
    if (name?.value.includes("#")) {
      out.push({
        range: rangeOf(located, name.node),
        severity: "error",
        message: `A model name cannot contain "#": it picks a variant. This model is skipped.`,
      });
    }
    out.push(...connectionChecks(located, ["models", index], context));
  }
  out.push(...duplicateNames(located, ["models"], "model"));
  return out;
}

/**
 * Problems in one of our YAML files, from its current text. YAML syntax
 * errors stop the other checks (the structure is not known yet).
 */
export function checkConfigFile(
  kind: ConfigFileKind,
  text: string,
  context: ConfigFileContext,
  options: {
    /**
     * YAML syntax and the file's own schema. Off when the editor's YAML
     * extension already reports them from the same schema, so each problem
     * shows once; the cross-file checks run either way.
     */
    shapeChecks?: boolean;
  } = {},
): ConfigFileDiagnostic[] {
  const shapeChecks = options.shapeChecks ?? true;
  const lines = new LineCounter();
  const doc = parseDocument(text, { lineCounter: lines, prettyErrors: false });
  const located = { doc, lines };
  if (doc.errors.length) {
    if (!shapeChecks) return [];
    return doc.errors.map((e) => ({
      range: rangeOf(located, null, [e.pos[0], e.pos[1]]),
      severity: "error",
      message: `YAML: ${e.message.split("\n")[0]}`,
    }));
  }
  const value = doc.toJS({ maxAliasCount: 100 });
  if (value === null || value === undefined) return [];
  const out = shapeChecks ? schemaProblems(located, kind, value) : [];
  if (kind === "config") out.push(...checkConfig(located, context));
  if (kind === "models") out.push(...checkModels(located, context));
  if (kind === "providers")
    out.push(...duplicateNames(located, ["providers"], "account"));
  return out;
}

export interface ConfigFileCompletion {
  label: string;
  detail?: string;
}

/**
 * Names to offer where the cursor is: after `from:` (catalog models and
 * their variants), `connection:` (accounts) or a mode's `model:`. `line` is
 * the text of the cursor's line up to the cursor.
 */
export function configFileCompletions(
  kind: ConfigFileKind,
  line: string,
  context: ConfigFileContext,
): ConfigFileCompletion[] | undefined {
  const m = /^\s*(?:-\s+)?(from|connection|model)\s*:\s*["']?([^"']*)$/.exec(
    line,
  );
  if (!m) return undefined;
  const key = m[1];
  if (key === "connection") {
    if (kind === "providers") return undefined;
    return context.accounts.map((a) => ({
      label: a,
      detail: "account (providers.yaml)",
    }));
  }
  if (kind !== "config") return undefined;
  const refs: ConfigFileCompletion[] = [];
  for (const model of context.models) {
    refs.push({ label: model.name, detail: "catalog model (models.yaml)" });
    for (const v of model.variants) {
      refs.push({
        label: `${model.name}#${v}`,
        detail: `variant of ${model.name}`,
      });
    }
  }
  return refs;
}

/** The context from parsed catalog models and accounts. */
export function configFileContext(
  models: z.infer<typeof catalogModelSchema>[],
  accounts: { name: string }[],
): ConfigFileContext {
  return {
    models: models.map((m) => ({
      name: m.name,
      variants: Object.keys(m.variants ?? {}),
    })),
    accounts: accounts.map((a) => a.name),
  };
}
