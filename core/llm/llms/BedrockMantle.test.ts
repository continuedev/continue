import BedrockMantle, { mantleRegionError } from "./BedrockMantle";

const make = (options: any = {}) =>
  new BedrockMantle({
    model: "openai.gpt-oss-120b",
    apiKey: "bedrock-key",
    ...options,
  }) as any;

afterEach(() => {
  delete process.env.AWS_BEARER_TOKEN_BEDROCK;
});

describe("BedrockMantle", () => {
  it("is registered as the bedrock-mantle provider", () => {
    expect(BedrockMantle.providerName).toBe("bedrock-mantle");
  });

  it("builds the endpoint from region (default us-east-1)", () => {
    expect(make().apiBase).toBe("https://bedrock-mantle.us-east-1.api.aws/v1/");
    expect(make({ region: "eu-west-1" }).apiBase).toBe(
      "https://bedrock-mantle.eu-west-1.api.aws/v1/",
    );
  });

  it("applies an explicit path prefix", () => {
    expect(
      make({ region: "us-west-2", mantlePathPrefix: "openai/v1" }).apiBase,
    ).toBe("https://bedrock-mantle.us-west-2.api.aws/openai/v1/");
  });

  it("keeps a custom apiBase untouched", () => {
    const base = "https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1/";
    expect(make({ apiBase: base }).apiBase).toBe(base);
  });

  it("gives the adapter the same region and prefix", () => {
    const llm = make({ region: "eu-west-2", mantlePathPrefix: "/openai/v1" });
    const adapter = llm.openaiAdapter;
    expect(adapter.constructor.name).toBe("BedrockMantleApi");
    expect(adapter.apiBase).toBe(
      "https://bedrock-mantle.eu-west-2.api.aws/openai/v1/",
    );
  });

  it("lets the adapter choose the URL when apiBase is not set", () => {
    // Unset apiBase is what allows prefix auto-detection in the adapter.
    const adapter = make({ region: "us-east-2" }).openaiAdapter;
    expect(adapter.apiBase).toBe(
      "https://bedrock-mantle.us-east-2.api.aws/v1/",
    );
    expect(adapter.prefixIsFixed).toBe(false);
  });

  it("falls back to AWS_BEARER_TOKEN_BEDROCK for the API key", () => {
    process.env.AWS_BEARER_TOKEN_BEDROCK = "env-key";
    expect(make({ apiKey: "" }).apiKey).toBe("env-key");
    expect(make({ apiKey: "cfg" }).apiKey).toBe("cfg");
  });

  it("passes an explicit token-limit parameter to the adapter", () => {
    const adapter = make({
      maxTokensParam: "max_completion_tokens",
    }).openaiAdapter;
    expect(adapter.maxTokensParam).toBe("max_completion_tokens");
  });

  it("lists models through the adapter and groups them for the picker", async () => {
    const llm = make();
    llm.openaiAdapter.list = async () => [
      { id: "qwen.qwen3-coder" },
      { id: "openai.gpt-oss-120b" },
    ];
    expect(await llm.listModels()).toEqual([
      "qwen.qwen3-coder",
      "openai.gpt-oss-120b",
    ]);
    const options = await llm.listAvailableModels();
    expect(options.map((o: any) => [o.provider, o.id])).toEqual([
      ["OpenAI", "openai.gpt-oss-120b"],
      ["Qwen", "qwen.qwen3-coder"],
    ]);
  });

  it("reports a model test result with latency", async () => {
    const llm = make();
    llm.chat = async () => ({ role: "assistant", content: " ok " });
    const result = await llm.testModel();
    expect(result).toMatchObject({
      modelId: "openai.gpt-oss-120b",
      reply: "ok",
    });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe("mantleRegionError", () => {
  it("accepts Mantle regions and the default", () => {
    expect(mantleRegionError("us-east-1")).toBeUndefined();
    expect(mantleRegionError(undefined)).toBeUndefined();
    expect(mantleRegionError("eu-west-1")).toBeUndefined();
  });

  it("explains regions without a Mantle endpoint", () => {
    const msg = mantleRegionError("eu-west-3");
    expect(msg).toContain("isn't available in eu-west-3");
    expect(msg).toContain("us-east-1");
  });
});
