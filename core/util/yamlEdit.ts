import * as YAML from "yaml";

/**
 * Edit YAML text with a callback that takes and returns a plain object,
 * keeping comments, key order and anchors. Plain `YAML.stringify(next)` drops
 * every comment, which is what GUI saves used to do to config.yaml.
 *
 * How the result is applied to the parsed document:
 * - A value that is structurally equal to the old one is left alone.
 * - Maps are merged key by key; keys missing from the result are removed and
 *   new keys are appended. Keys whose value is `undefined` count as absent.
 * - Scalars are replaced in place, so a comment on the line survives.
 * - Sequence items are matched by identity, not by position (see `identityOf`).
 *   A comment therefore stays with its entry when an earlier entry is removed,
 *   inserted or the list is reordered. Entries with no match are new nodes.
 *
 * Not byte-for-byte: runs of blank lines collapse to one and the spacing
 * before a trailing comment is normalised. Line endings and a leading BOM are
 * kept as found.
 */

export interface YamlEditResult {
  /** Text to write, or undefined when nothing changed (skip the write). */
  text: string | undefined;
  /** Set when the input could not be edited; the file must be left alone. */
  error?: string;
}

export function editYamlText<T>(
  source: string,
  callback: (config: T) => T,
): YamlEditResult {
  const bom = source.startsWith("\uFEFF") ? "\uFEFF" : "";
  const body = bom ? source.slice(1) : source;

  const doc = YAML.parseDocument(body);
  if (doc.errors.length > 0) {
    return { text: undefined, error: doc.errors[0].message };
  }
  const current = doc.toJS();
  if (!isPlainObject(current)) {
    return { text: undefined, error: "config.yaml is not a valid object" };
  }
  const updated = callback(structuredClone(current) as T);
  if (structurallyEqual(current, updated)) return { text: undefined };
  if (!isPlainObject(updated)) {
    return { text: undefined, error: "the edit did not return an object" };
  }

  mergeMap(doc, doc.contents as YAML.YAMLMap, updated);

  // flowCollectionPadding:false keeps `[chat]` from becoming `[ chat ]`.
  let text = doc.toString({ flowCollectionPadding: false });
  if (body.includes("\r\n")) text = text.replace(/\r?\n/g, "\r\n");
  text = bom + text;
  return { text: text === source ? undefined : text };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isScalarValue(v: unknown): boolean {
  return !isPlainObject(v) && !Array.isArray(v);
}

/** Deep equality that, like YAML output, treats `undefined` properties as absent. */
export function structurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => structurallyEqual(x, b[i]))
    );
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!structurallyEqual(a[k], b[k])) return false;
    }
    return true;
  }
  // NaN is the only value not equal to itself that YAML can hold.
  return Number.isNaN(a) && Number.isNaN(b);
}

function nodeToJS(node: unknown, doc: YAML.Document): unknown {
  // toJS(doc) resolves aliases; toJSON() alone returns a stub for them, which
  // would make an unchanged `*anchor` entry look edited and expand it.
  return YAML.isNode(node) ? node.toJS(doc) : node;
}

function mergeMap(
  doc: YAML.Document,
  map: YAML.YAMLMap,
  next: Record<string, unknown>,
): void {
  const wanted = (k: string) => k in next && next[k] !== undefined;

  for (const item of [...map.items]) {
    const key = YAML.isScalar(item.key)
      ? String(item.key.value)
      : String(item.key);
    if (!wanted(key)) map.delete(key);
  }
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    const existing = map.get(key, true);
    if (existing === undefined) {
      map.set(key, doc.createNode(value));
    } else if (!structurallyEqual(nodeToJS(existing, doc), value)) {
      map.set(key, mergeNode(doc, existing, value));
    }
  }
}

/** Returns the node to store: the existing one updated in place when possible. */
function mergeNode(
  doc: YAML.Document,
  existing: unknown,
  value: unknown,
): unknown {
  if (YAML.isMap(existing) && isPlainObject(value)) {
    mergeMap(doc, existing, value);
    return existing;
  }
  if (YAML.isSeq(existing) && Array.isArray(value)) {
    // An empty `[]` placeholder (a new file's `models: []`) that gains
    // entries with fields becomes a block list: flow style would put every
    // model on one line. Lists of plain values (`roles: [chat]`) keep it.
    if (
      existing.flow &&
      existing.items.length === 0 &&
      value.some((v) => isPlainObject(v) || Array.isArray(v))
    ) {
      existing.flow = false;
    }
    mergeSeq(doc, existing, value);
    return existing;
  }
  if (YAML.isScalar(existing) && isScalarValue(value) && value !== null) {
    existing.value = value;
    return existing;
  }
  return doc.createNode(value);
}

/**
 * What makes a list entry "the same entry" across an edit. config.yaml lists
 * are models, rules, prompts, context providers and so on, which are named; a
 * model with no name is told apart by provider plus model. Scalars are matched
 * by value. Returns undefined for entries with no stable identity (nested
 * lists, unnamed objects); those are paired by equal content, then by slot.
 */
function identityOf(v: unknown): string | undefined {
  if (isPlainObject(v)) {
    if (typeof v.name === "string") return `name:${v.name}`;
    if (typeof v.provider === "string" && typeof v.model === "string") {
      return `model:${v.provider}/${v.model}`;
    }
    return undefined;
  }
  if (Array.isArray(v)) return undefined;
  return `value:${typeof v}:${String(v)}`;
}

function sameKind(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b);
  }
  return isPlainObject(a) === isPlainObject(b);
}

/**
 * `yaml` stores a comment above the first entry of a block list on the list
 * itself, so it would stay put when that entry is removed or something is
 * inserted before it. When every other entry carries its own comment the list
 * is clearly commented per entry, so hand the leading comment to the first
 * entry. A lone comment above a list is ambiguous (it may describe the whole
 * list) and is left where it is, because losing a comment is worse.
 */
function bindLeadingComment(seq: YAML.YAMLSeq): void {
  const lead = seq.commentBefore;
  if (!lead || seq.flow || seq.items.length < 2) return;
  const [first, ...rest] = seq.items;
  if (!YAML.isNode(first) || first.commentBefore) return;
  if (!rest.every((n) => YAML.isNode(n) && n.commentBefore)) return;
  first.commentBefore = lead;
  seq.commentBefore = undefined;
}

function mergeSeq(
  doc: YAML.Document,
  seq: YAML.YAMLSeq,
  next: unknown[],
): void {
  bindLeadingComment(seq);
  const old = seq.items.map((n) => nodeToJS(n, doc));
  const used = new Set<number>();
  const pairing: (number | undefined)[] = new Array(next.length).fill(
    undefined,
  );
  const pair = (i: number, j: number) => {
    pairing[i] = j;
    used.add(j);
  };

  // 1. Same identity.
  next.forEach((value, i) => {
    const id = identityOf(value);
    if (id === undefined) return;
    const j = old.findIndex((o, k) => !used.has(k) && identityOf(o) === id);
    if (j >= 0) pair(i, j);
  });
  // 2. No identity: identical content wins, then the same slot.
  const anonymous = (i: number) =>
    pairing[i] === undefined && identityOf(next[i]) === undefined;
  next.forEach((value, i) => {
    if (!anonymous(i)) return;
    const j = old.findIndex(
      (o, k) =>
        !used.has(k) &&
        identityOf(o) === undefined &&
        structurallyEqual(o, value),
    );
    if (j >= 0) pair(i, j);
  });
  next.forEach((value, i) => {
    if (!anonymous(i)) return;
    if (
      i < old.length &&
      !used.has(i) &&
      identityOf(old[i]) === undefined &&
      sameKind(old[i], value)
    ) {
      pair(i, i);
    }
  });

  seq.items = next.map((value, i) => {
    const j = pairing[i];
    if (j === undefined) return doc.createNode(value);
    const existing = seq.items[j];
    return structurallyEqual(old[j], value)
      ? existing
      : mergeNode(doc, existing, value);
  }) as typeof seq.items;
}
