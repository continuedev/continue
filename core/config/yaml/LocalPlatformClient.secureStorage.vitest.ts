import { FQSN, SecretType } from "@continuedev/config-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDE } from "../..";
import { SECURE_STORAGE_TIMEOUT_MS } from "../secretStorage";
import { LocalPlatformClient } from "./LocalPlatformClient";

const dotEnv: Record<string, string> = {};
vi.mock("../../util/paths", () => ({
  getContinueDotEnv: () => dotEnv,
}));

const fqsn: FQSN = { packageSlugs: [], secretName: "CONTINUOUS_TEST_API_KEY" };

function makeIde(secrets: Record<string, string> | Error | undefined) {
  return {
    getWorkspaceDirs: async () => [],
    fileExists: async () => false,
    readFile: async () => "",
    readSecrets: async (keys: string[]) => {
      if (secrets instanceof Error) throw secrets;
      return Object.fromEntries(
        keys
          .filter((k) => secrets && k in secrets)
          .map((k) => [k, secrets![k]]),
      );
    },
  } as unknown as IDE;
}

describe("LocalPlatformClient secure storage lookup", () => {
  beforeEach(() => {
    delete process.env[fqsn.secretName];
    for (const k of Object.keys(dotEnv)) delete dotEnv[k];
  });
  afterEach(() => {
    delete process.env[fqsn.secretName];
  });

  it("finds a secret in the IDE's secure storage", async () => {
    const client = new LocalPlatformClient(
      makeIde({ [fqsn.secretName]: "from-secure" }),
    );
    const [result] = await client.resolveFQSNs([fqsn]);
    expect(result).toMatchObject({ found: true, value: "from-secure" });
    expect(result?.secretLocation?.secretType).toBe(SecretType.LocalEnv);
  });

  it("reads secure storage before ~/.continuous/.env, and .env before process.env", async () => {
    process.env[fqsn.secretName] = "from-process";
    dotEnv[fqsn.secretName] = "from-dotenv";
    const ide = makeIde({ [fqsn.secretName]: "from-secure" });

    let [result] = await new LocalPlatformClient(ide).resolveFQSNs([fqsn]);
    expect((result as any).value).toBe("from-secure");

    // Nothing in secure storage: the .env file is next.
    [result] = await new LocalPlatformClient(makeIde({})).resolveFQSNs([fqsn]);
    expect((result as any).value).toBe("from-dotenv");

    // Nothing in either: the process environment is last.
    delete dotEnv[fqsn.secretName];
    [result] = await new LocalPlatformClient(makeIde({})).resolveFQSNs([fqsn]);
    expect((result as any).value).toBe("from-process");
  });

  it("reads secure storage before workspace .env files too", async () => {
    const ide = makeIde({ [fqsn.secretName]: "from-secure" });
    (ide as any).getWorkspaceDirs = async () => ["file:///ws"];
    (ide as any).fileExists = async () => true;
    (ide as any).readFile = async () => `${fqsn.secretName}=from-workspace\n`;

    let [result] = await new LocalPlatformClient(ide).resolveFQSNs([fqsn]);
    expect((result as any).value).toBe("from-secure");

    (ide as any).readSecrets = async () => ({});
    [result] = await new LocalPlatformClient(ide).resolveFQSNs([fqsn]);
    expect((result as any).value).toBe("from-workspace");
  });

  it("falls through to process.env when secure storage has nothing", async () => {
    process.env[fqsn.secretName] = "from-process";
    const [result] = await new LocalPlatformClient(makeIde({})).resolveFQSNs([
      fqsn,
    ]);
    expect((result as any).value).toBe("from-process");
  });

  it("treats a failing secure storage as not found", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [result] = await new LocalPlatformClient(
      makeIde(new Error("keychain locked")),
    ).resolveFQSNs([fqsn]);
    expect(result?.found).toBeUndefined();
    warn.mockRestore();
  });

  it("works with an IDE that has no secret storage at all", async () => {
    const ide = makeIde(undefined);
    (ide as any).readSecrets = undefined;
    const [result] = await new LocalPlatformClient(ide).resolveFQSNs([fqsn]);
    expect(result?.found).toBeUndefined();
  });

  it("does not wait forever for an IDE that never answers, and asks only once", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      dotEnv[fqsn.secretName] = "from-dotenv";
      const readSecrets = vi.fn(
        () => new Promise<Record<string, string>>(() => {}),
      );
      const ide = makeIde({});
      (ide as any).readSecrets = readSecrets;
      const client = new LocalPlatformClient(ide);

      const first = client.resolveFQSNs([fqsn]);
      await vi.advanceTimersByTimeAsync(SECURE_STORAGE_TIMEOUT_MS + 1);
      expect(((await first)[0] as any).value).toBe("from-dotenv");

      // Later lookups skip the unresponsive storage instead of waiting again.
      expect(((await client.resolveFQSNs([fqsn]))[0] as any).value).toBe(
        "from-dotenv",
      );
      expect(readSecrets).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });
});
