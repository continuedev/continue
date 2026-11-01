import { beforeEach, describe, expect, it } from "vitest";
import { BedrockApi } from "./Bedrock.js";

const calls: Array<string | undefined> = [];
let chainImpl: (p: string | undefined) => Promise<any>;

class TestApi extends BedrockApi {
  protected async credentialChain(profile: string | undefined) {
    calls.push(profile);
    return chainImpl(profile);
  }
}
const make = (env: any = {}, extra: any = {}) =>
  new TestApi({ provider: "bedrock", env, ...extra } as any) as any;

describe("BedrockApi credentials", () => {
  beforeEach(() => {
    calls.length = 0;
    chainImpl = async () => ({ accessKeyId: "k", secretAccessKey: "s" });
  });

  it("passes sessionToken with explicit keys", async () => {
    const api = make({
      accessKeyId: "a",
      secretAccessKey: "b",
      sessionToken: "t",
    });
    expect(await api.getCreds()).toEqual({
      accessKeyId: "a",
      secretAccessKey: "b",
      sessionToken: "t",
    });
    expect(calls).toEqual([]);
  });

  it("uses an explicit profile strictly and adds an SSO hint", async () => {
    chainImpl = async () => {
      throw new Error(
        "The SSO session associated with this profile has expired",
      );
    };
    await expect(make({ profile: "work" }).getCreds()).rejects.toThrow(
      /aws sso login --profile work/,
    );
    expect(calls).toEqual(["work"]);
  });

  it("falls back from legacy 'bedrock' profile to the default chain", async () => {
    chainImpl = async (p) => {
      if (p === "bedrock") throw new Error("nope");
      return { accessKeyId: "d", secretAccessKey: "s" };
    };
    expect((await make().getCreds()).accessKeyId).toBe("d");
    expect(calls).toEqual(["bedrock", undefined]);
  });

  it("reads AWS_BEARER_TOKEN_BEDROCK only when nothing else is configured", () => {
    process.env.AWS_BEARER_TOKEN_BEDROCK = "env";
    try {
      expect(make().resolveApiKey()).toBe("env");
      expect(make({ profile: "p" }).resolveApiKey()).toBeUndefined();
      expect(make({}, { apiKey: "cfg" }).resolveApiKey()).toBe("cfg");
    } finally {
      delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    }
  });
});
