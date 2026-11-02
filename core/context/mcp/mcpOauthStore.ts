import crypto from "node:crypto";

import { IDE } from "../..";
import { GlobalContext, GlobalContextType } from "../../util/GlobalContext";

export type McpOauthRecord = GlobalContextType["mcpOauthStorage"][string];

/**
 * Where MCP OAuth credentials (access/refresh tokens, dynamic client
 * registration, PKCE verifier) are kept.
 *
 * They go into the IDE's secret storage (`readSecrets` / `writeSecrets`: an
 * encrypted store in VS Code) rather than the plaintext `globalContext.json`.
 * Some hosts (the CLI, or an IDE without secret storage) can't persist
 * secrets; there we verify the round trip and fall back to the old location, so
 * a sign-in is never silently lost. Records found in the old location are moved
 * to secret storage the first time they are read.
 *
 * `IDE.writeSecrets` has no delete, so a cleared record is stored as "".
 */

const KEY_PREFIX = "mcpOauth.";

/** Serializes read-modify-write per server across provider instances. */
const queues = new Map<string, Promise<unknown>>();

export function mcpOauthSecretKey(serverUrl: string): string {
  return (
    KEY_PREFIX + crypto.createHash("sha256").update(serverUrl).digest("hex")
  );
}

export class McpOauthStore {
  private readonly key: string;

  constructor(
    private readonly serverUrl: string,
    private readonly ide: IDE,
    private readonly globalContext: GlobalContext = new GlobalContext(),
  ) {
    this.key = mcpOauthSecretKey(serverUrl);
  }

  private async readSecret(): Promise<string | undefined> {
    if (typeof this.ide.readSecrets !== "function") return undefined;
    try {
      const value = (await this.ide.readSecrets([this.key]))?.[this.key];
      return value ? value : undefined;
    } catch {
      return undefined;
    }
  }

  /** True only if the value can be read back, i.e. the host really persists. */
  private async writeSecret(value: string): Promise<boolean> {
    if (
      typeof this.ide.writeSecrets !== "function" ||
      typeof this.ide.readSecrets !== "function"
    ) {
      return false;
    }
    try {
      await this.ide.writeSecrets({ [this.key]: value });
      const stored = (await this.ide.readSecrets([this.key]))?.[this.key];
      return (stored ?? "") === value;
    } catch {
      return false;
    }
  }

  private legacyRecord(): McpOauthRecord | undefined {
    return this.globalContext.get("mcpOauthStorage")?.[this.serverUrl];
  }

  private setLegacy(record: McpOauthRecord | undefined) {
    const all = { ...(this.globalContext.get("mcpOauthStorage") ?? {}) };
    if (record && Object.keys(record).length > 0) {
      all[this.serverUrl] = record;
    } else {
      delete all[this.serverUrl];
    }
    this.globalContext.update("mcpOauthStorage", all);
  }

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const previous = queues.get(this.key) ?? Promise.resolve();
    const next = previous.then(fn, fn);
    queues.set(
      this.key,
      next.catch(() => {}),
    );
    return next;
  }

  private async loadUnlocked(): Promise<McpOauthRecord> {
    const secret = await this.readSecret();
    if (secret) {
      try {
        const record = JSON.parse(secret) as McpOauthRecord;
        // a copy left behind by an interrupted migration is stale plaintext
        if (this.legacyRecord()) this.setLegacy(undefined);
        return record;
      } catch {
        // unreadable secret: fall through to whatever else we have
      }
    }
    const legacy = this.legacyRecord();
    if (!legacy) return {};
    // Move plaintext credentials into secret storage when it works
    if (await this.writeSecret(JSON.stringify(legacy))) {
      this.setLegacy(undefined);
    }
    return legacy;
  }

  async load(): Promise<McpOauthRecord> {
    return this.serialize(() => this.loadUnlocked());
  }

  /** Read-modify-write; `update` returns the new record (or undefined to clear). */
  async update(
    update: (current: McpOauthRecord) => McpOauthRecord | undefined,
  ): Promise<void> {
    await this.serialize(async () => {
      const next = update(await this.loadUnlocked());
      if (!next || Object.keys(next).length === 0) {
        await this.clearUnlocked();
        return;
      }
      if (await this.writeSecret(JSON.stringify(next))) {
        this.setLegacy(undefined);
      } else {
        this.setLegacy(next);
      }
    });
  }

  private async clearUnlocked(): Promise<void> {
    await this.writeSecret("");
    this.setLegacy(undefined);
  }

  async clear(): Promise<void> {
    await this.serialize(() => this.clearUnlocked());
  }
}
