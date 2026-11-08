import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readSecretFromEnvFile } from "../../util/secretsFile";
import { catalogEntryFor } from "./accountSetup";
import {
  moveCredentialsToSecrets,
  requestHasCredentials,
} from "./modelCredentials";

const CREDENTIALS = {
  accessKeyId: "AKIAFAKE",
  secretAccessKey: "fake-secret",
  sessionToken: "fake-token",
};
const PLAIN_VALUES = /AKIAFAKE|fake-secret|fake-token/;

const model = (title: string, extra: object = CREDENTIALS) =>
  ({ title, provider: "bedrock", model: title, ...extra }) as any;

const request = (extra = {}) => ({
  provider: "bedrock",
  connection: { region: "us-east-1" },
  add: [model("a"), model("b")],
  ...extra,
});

function fakeIde(keep = true) {
  const secrets: Record<string, string> = {};
  let writes = 0;
  return {
    secrets,
    writes: () => writes,
    readSecrets: async (keys: string[]) =>
      Object.fromEntries(
        keys.filter((k) => k in secrets).map((k) => [k, secrets[k]]),
      ),
    writeSecrets: async (s: Record<string, string>) => {
      writes++;
      if (keep) Object.assign(secrets, s);
    },
  };
}

describe("moveCredentialsToSecrets", () => {
  let continueDir: string;
  beforeEach(() => {
    continueDir = fs.mkdtempSync(path.join(os.tmpdir(), "credentials-"));
  });
  afterEach(() => {
    fs.rmSync(continueDir, { recursive: true, force: true });
  });

  const move = (req: any, ide: any, storage: "secure" | "env" = "secure") =>
    moveCredentialsToSecrets({ req, ide, storage, continueDir });

  it("stores each credential once and leaves only references", async () => {
    const ide = fakeIde();
    const { req, error } = await move(request(), ide);
    expect(error).toBeUndefined();
    expect(ide.writes()).toBe(3);
    expect(
      ide.secrets.CONTINUOUS_BEDROCK_US_EAST_1_SECRET_ACCESS_KEY_API_KEY,
    ).toBe("fake-secret");
    expect(JSON.stringify(req)).not.toMatch(PLAIN_VALUES);
    expect((req.add![1] as any).accessKeyId).toBe(
      "${{ secrets.CONTINUOUS_BEDROCK_US_EAST_1_ACCESS_KEY_ID_API_KEY }}",
    );
  });

  it("leaves no plain value in the catalog entry", async () => {
    const { req } = await move(request(), fakeIde());
    const entry = catalogEntryFor(req.add![0], "bedrock-us-east-1");
    expect(entry.env.secretAccessKey).toMatch(/^\$\{\{ secrets\./);
    expect(JSON.stringify(entry)).not.toMatch(PLAIN_VALUES);
  });

  it("gives another account its own secrets", async () => {
    const ide = fakeIde();
    await move(request({ account: { name: "work" } }), ide);
    expect(Object.keys(ide.secrets).join()).toContain("CONTINUOUS_WORK_");
  });

  it("can keep them in the .env file", async () => {
    await move(request(), fakeIde(), "env");
    expect(
      readSecretFromEnvFile(
        continueDir,
        "CONTINUOUS_BEDROCK_US_EAST_1_ACCESS_KEY_ID_API_KEY",
      ),
    ).toBe("AKIAFAKE");
  });

  it("reports a failure without saying the value", async () => {
    const { error } = await move(request(), fakeIde(false));
    expect(error).toBeTruthy();
    expect(error).not.toMatch(PLAIN_VALUES);
  });

  it("only acts on real values", () => {
    expect(requestHasCredentials(request())).toBe(true);
    expect(
      requestHasCredentials({ provider: "bedrock", add: [model("a", {})] }),
    ).toBe(false);
    expect(
      requestHasCredentials({
        provider: "bedrock",
        add: [model("a", { accessKeyId: "${{ secrets.X }}" })],
      }),
    ).toBe(false);
  });
});
