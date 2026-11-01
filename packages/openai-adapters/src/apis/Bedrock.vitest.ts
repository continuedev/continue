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

  it("builds service tier / latency / guardrail fields from env", () => {
    const api = make({
      serviceTier: "flex",
      latency: "optimized",
      guardrailIdentifier: "gr-1",
      guardrailVersion: "2",
    });
    expect(api.extraConverseFields()).toEqual({
      serviceTier: { type: "flex" },
      performanceConfig: { latency: "optimized" },
      guardrailConfig: { guardrailIdentifier: "gr-1", guardrailVersion: "2" },
    });
    expect(make().extraConverseFields()).toEqual({});
  });
});

describe("BedrockApi networking (requestOptions)", () => {
  const SAVED = { ...process.env };
  const clear = () => {
    for (const k of [
      "HTTPS_PROXY",
      "https_proxy",
      "HTTP_PROXY",
      "http_proxy",
      "NO_PROXY",
      "no_proxy",
    ]) {
      delete process.env[k];
    }
  };
  afterEach(() => {
    process.env = { ...SAVED };
  });

  const handlerOf = async (config: any) => {
    const api = new TestApi({
      provider: "bedrock",
      apiKey: "k",
      ...config,
    } as any) as any;
    const client = await api.getClient();
    return client.config.requestHandler;
  };

  it("keeps the SDK's default handler when nothing is configured (Linux)", async () => {
    clear();
    const handler = await handlerOf({});
    if (process.platform === "linux") {
      expect(handler.constructor.name).not.toBe("NodeHttpHandler");
    }
  });

  it.each([
    ["caBundlePath", { caBundlePath: "/does/not/matter.pem" }],
    ["useSystemCa", { useSystemCa: true }],
    ["verifySsl=false", { verifySsl: false }],
    ["proxy", { proxy: "http://proxy.corp:3128" }],
  ])("uses a custom handler for %s", async (_name, requestOptions) => {
    clear();
    const handler = await handlerOf({ requestOptions });
    expect(handler.constructor.name).toBe("NodeHttpHandler");
  });

  it("picks up HTTPS_PROXY from the environment", async () => {
    clear();
    process.env.HTTPS_PROXY = "http://envproxy:8080";
    const handler = await handlerOf({});
    expect(handler.constructor.name).toBe("NodeHttpHandler");
  });

  it("does not proxy hosts listed in noProxy", async () => {
    clear();
    const handler = await handlerOf({
      requestOptions: { proxy: "http://proxy:1", noProxy: ["*.amazonaws.com"] },
    });
    expect(handler.constructor.name).not.toBe("NodeHttpHandler");
  });
});
