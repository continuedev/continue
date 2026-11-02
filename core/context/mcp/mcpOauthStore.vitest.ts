import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { IDE } from "../..";
import { GlobalContext } from "../../util/GlobalContext";
import { getGlobalContextFilePath } from "../../util/paths";
import { McpOauthStore, mcpOauthSecretKey } from "./mcpOauthStore";

const URL_A = "https://mcp.example.com/mcp";
const URL_B = "https://other.example.com/mcp";
const tokens = { access_token: "at-secret", token_type: "Bearer" };

function secretsIde(
  backing: Record<string, string> = {},
  persists = true,
): IDE {
  return {
    readSecrets: async (keys: string[]) =>
      Object.fromEntries(
        keys.filter((k) => k in backing).map((k) => [k, backing[k]]),
      ),
    writeSecrets: async (s: Record<string, string>) => {
      if (persists) Object.assign(backing, s);
    },
  } as unknown as IDE;
}

describe("McpOauthStore", () => {
  let file: string;
  const plaintext = () => fs.readFileSync(file, "utf8");
  beforeEach(() => {
    file = getGlobalContextFilePath();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });
  afterEach(() => {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  test("tokens go to secret storage, not globalContext.json", async () => {
    const backing: Record<string, string> = {};
    const store = new McpOauthStore(URL_A, secretsIde(backing));
    await store.update((c) => ({ ...c, tokens }));

    expect(JSON.parse(backing[mcpOauthSecretKey(URL_A)]).tokens).toEqual(
      tokens,
    );
    expect(fs.existsSync(file) ? plaintext() : "").not.toContain("at-secret");
    expect((await store.load()).tokens).toEqual(tokens);
  });

  test("servers are isolated and keys are not derived from the raw URL", async () => {
    const backing: Record<string, string> = {};
    const ide = secretsIde(backing);
    await new McpOauthStore(URL_A, ide).update((c) => ({ ...c, tokens }));
    expect(await new McpOauthStore(URL_B, ide).load()).toEqual({});
    expect(mcpOauthSecretKey(URL_A)).not.toContain("example");
  });

  test("a plaintext record is migrated and removed from globalContext.json", async () => {
    const backing: Record<string, string> = {};
    new GlobalContext().update("mcpOauthStorage", {
      [URL_A]: { tokens, codeVerifier: "v" },
    });
    expect(plaintext()).toContain("at-secret");

    const store = new McpOauthStore(URL_A, secretsIde(backing));
    expect(await store.load()).toEqual({ tokens, codeVerifier: "v" });

    expect(plaintext()).not.toContain("at-secret");
    expect(JSON.parse(backing[mcpOauthSecretKey(URL_A)]).tokens).toEqual(
      tokens,
    );
  });

  test("hosts that can't persist secrets keep the old location, nothing is lost", async () => {
    const ide = secretsIde({}, false);
    const store = new McpOauthStore(URL_A, ide);
    await store.update((c) => ({ ...c, tokens }));
    expect(plaintext()).toContain("at-secret");
    expect((await new McpOauthStore(URL_A, ide).load()).tokens).toEqual(tokens);

    // a legacy record also survives a failed migration
    expect((await store.load()).tokens).toEqual(tokens);
    expect(plaintext()).toContain("at-secret");
  });

  test("an IDE without secret methods falls back too", async () => {
    const store = new McpOauthStore(URL_A, {} as IDE);
    await store.update((c) => ({ ...c, tokens }));
    expect((await store.load()).tokens).toEqual(tokens);
  });

  test("clear removes the secret and any plaintext copy", async () => {
    const backing: Record<string, string> = {};
    const ide = secretsIde(backing);
    const store = new McpOauthStore(URL_A, ide);
    await store.update((c) => ({ ...c, tokens }));
    new GlobalContext().update("mcpOauthStorage", { [URL_A]: { tokens } });

    await store.clear();
    expect(await new McpOauthStore(URL_A, ide).load()).toEqual({});
    expect(plaintext()).not.toContain("at-secret");
  });

  test("concurrent updates don't lose writes", async () => {
    const ide = secretsIde();
    const store = new McpOauthStore(URL_A, ide);
    await Promise.all([
      store.update((c) => ({ ...c, tokens })),
      store.update((c) => ({ ...c, codeVerifier: "v" })),
      store.update((c) => ({
        ...c,
        clientInformation: { client_id: "cid" } as any,
      })),
    ]);
    const rec = await new McpOauthStore(URL_A, ide).load();
    expect(rec.tokens).toEqual(tokens);
    expect(rec.codeVerifier).toBe("v");
    expect((rec.clientInformation as any).client_id).toBe("cid");
  });
});
