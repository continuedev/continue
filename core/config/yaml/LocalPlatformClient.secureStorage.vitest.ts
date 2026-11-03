import { FQSN, SecretType } from "@continuedev/config-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDE } from "../..";
import { LocalPlatformClient } from "./LocalPlatformClient";

const dotEnv: Record<string, string> = {};
vi.mock("../../util/paths", () => ({
  getContinueDotEnv: () => dotEnv,
}));

const fqsn: FQSN = { packageSlugs: [], secretName: "CONTINUED_TEST_API_KEY" };

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

  it("prefers ~/.continue/.env, then falls back to secure storage over process.env", async () => {
    process.env[fqsn.secretName] = "from-process";
    const ide = makeIde({ [fqsn.secretName]: "from-secure" });

    let [result] = await new LocalPlatformClient(ide).resolveFQSNs([fqsn]);
    expect((result as any).value).toBe("from-secure");

    dotEnv[fqsn.secretName] = "from-dotenv";
    [result] = await new LocalPlatformClient(ide).resolveFQSNs([fqsn]);
    expect((result as any).value).toBe("from-dotenv");
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
});
