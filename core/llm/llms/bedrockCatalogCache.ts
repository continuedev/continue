import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import { getContinueGlobalPath } from "../../util/paths.js";
import type { BedrockModelOption } from "./bedrockHelpers.js";

/**
 * The Bedrock model catalog (ListFoundationModels + ListInferenceProfiles +
 * the access and use-case lookups) per account and region. Listing takes a
 * few seconds, and the cache tip, the config-load check and the model picker
 * all want the same answer, so it is kept for an hour in memory and on disk
 * under the global folder. "Test connection" bypasses it.
 */

export const BEDROCK_CATALOG_TTL_MS = 60 * 60 * 1000;

/** How a Bedrock instance identifies its account, without a network call. */
export interface BedrockCatalogIdentity {
  apiKey?: string;
  accessKeyId?: string;
  /** Only an explicitly configured profile; the default chain has no name. */
  profile?: string;
}

interface CachedCatalog {
  key: string;
  fetchedAt: number;
  models: BedrockModelOption[];
}

const memory = new Map<string, CachedCatalog>();

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * The cache key for an account and region. Secrets are hashed so the key can
 * name a file; a profile is named as is, and nothing configured is the
 * default credential chain.
 */
export function bedrockCatalogCacheKey(
  identity: BedrockCatalogIdentity,
  region: string | undefined,
): string {
  const who = identity.apiKey
    ? `key:${sha256(identity.apiKey).slice(0, 24)}`
    : identity.accessKeyId
      ? `akid:${sha256(identity.accessKeyId).slice(0, 24)}`
      : identity.profile
        ? `profile:${identity.profile}`
        : "default-chain";
  return `${who}@${region ?? "unknown-region"}`;
}

function cacheDir(): string {
  return path.join(getContinueGlobalPath(), "bedrock-catalog");
}

function cacheFile(key: string): string {
  return path.join(cacheDir(), `${sha256(key).slice(0, 32)}.json`);
}

function isFresh(entry: CachedCatalog, now: number): boolean {
  return (
    now - entry.fetchedAt < BEDROCK_CATALOG_TTL_MS && entry.fetchedAt <= now
  );
}

/**
 * The cached catalog for `key`, or undefined when there is none or it is
 * older than an hour. Memory first, then disk (which also refills memory).
 */
export function readBedrockCatalogCache(
  key: string,
  now: number = Date.now(),
): BedrockModelOption[] | undefined {
  const inMemory = memory.get(key);
  if (inMemory) {
    if (isFresh(inMemory, now)) return inMemory.models;
    memory.delete(key);
  }
  try {
    const parsed = JSON.parse(
      fs.readFileSync(cacheFile(key), "utf8"),
    ) as Partial<CachedCatalog>;
    if (
      parsed.key !== key ||
      typeof parsed.fetchedAt !== "number" ||
      !Array.isArray(parsed.models)
    ) {
      return undefined;
    }
    const entry: CachedCatalog = {
      key,
      fetchedAt: parsed.fetchedAt,
      models: parsed.models,
    };
    if (!isFresh(entry, now)) return undefined;
    memory.set(key, entry);
    return entry.models;
  } catch {
    return undefined;
  }
}

/** Remember a freshly listed catalog. The disk write is best effort. */
export function writeBedrockCatalogCache(
  key: string,
  models: BedrockModelOption[],
  now: number = Date.now(),
): void {
  const entry: CachedCatalog = { key, fetchedAt: now, models };
  memory.set(key, entry);
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(cacheFile(key), JSON.stringify(entry));
  } catch {
    // A read-only global folder only costs the next process a listing.
  }
}

/** Forget every cached catalog. `disk` also removes the files (tests). */
export function clearBedrockCatalogCache(options?: { disk?: boolean }): void {
  memory.clear();
  if (options?.disk) {
    try {
      fs.rmSync(cacheDir(), { recursive: true, force: true });
    } catch {
      // Nothing to remove.
    }
  }
}
