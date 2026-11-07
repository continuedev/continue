import { describe, expect, it } from "vitest";

import { describeAccountConnections } from "../providerSetup";
import {
  accountNameFor,
  applyAccountSetup,
  applyConvertToAccount,
  catalogEntryFor,
} from "./accountSetup";

const strataModel = {
  title: "qwen3.8-flash-next-nvfp4-nvfp4",
  provider: "openai",
  model: "qwen3.8-flash-next-nvfp4-nvfp4",
  apiBase: "http://127.0.0.1:8083/v1/",
  contextLength: 524288,
  capabilities: { tools: true, uploadImage: true },
} as any;

describe("accountNameFor", () => {
  it("prefers the suggested name, then the provider and where it is", () => {
    expect(accountNameFor("openai", {}, "Strata")).toBe("strata");
    expect(
      accountNameFor("openai", { apiBase: "http://127.0.0.1:8083/v1/" }),
    ).toBe("openai-127.0.0.1-8083");
    expect(accountNameFor("bedrock", { region: "us-east-1" })).toBe(
      "bedrock-us-east-1",
    );
    expect(accountNameFor("anthropic")).toBe("anthropic");
  });
});

describe("catalogEntryFor", () => {
  it("keeps what the model is, without the connection", () => {
    expect(catalogEntryFor(strataModel, "strata")).toEqual({
      name: "qwen3.8-flash-next-nvfp4-nvfp4",
      connection: "strata",
      model: "qwen3.8-flash-next-nvfp4-nvfp4",
      contextLength: 524288,
      capabilities: ["tool_use", "image_input"],
    });
  });
});

describe("applyAccountSetup", () => {
  const empty = () => ({ providers: {}, models: {}, config: {} as any });

  it("writes an account, a catalog model and a from: entry", () => {
    const out = applyAccountSetup(empty(), {
      provider: "openai",
      connection: { apiBase: "http://127.0.0.1:8083/v1/" },
      add: [strataModel],
      key: { storage: "secure", secretName: "CONTINUED_LOCAL_API_KEY" },
      accountName: "Strata",
    });
    expect(out.account).toBe("strata");
    expect(out.providers.providers).toEqual([
      {
        name: "strata",
        provider: "openai",
        apiBase: "http://127.0.0.1:8083/v1/",
        apiKey: "${{ secrets.CONTINUED_LOCAL_API_KEY }}",
      },
    ]);
    expect(out.models.models).toHaveLength(1);
    expect(out.models.models[0]).toMatchObject({
      connection: "strata",
      model: "qwen3.8-flash-next-nvfp4-nvfp4",
    });
    expect(out.config.models).toEqual([
      { from: "qwen3.8-flash-next-nvfp4-nvfp4" },
    ]);
  });

  it("reuses the account with the same endpoint and the catalog model, so a second save adds nothing", () => {
    const first = applyAccountSetup(empty(), {
      provider: "openai",
      connection: { apiBase: "http://127.0.0.1:8083/v1" },
      add: [strataModel],
    });
    const second = applyAccountSetup(
      {
        providers: first.providers,
        models: first.models,
        config: first.config,
      },
      {
        provider: "openai",
        connection: { apiBase: "http://127.0.0.1:8083/v1/" },
        add: [strataModel],
        accountName: "something-else",
      },
    );
    expect(second.account).toBe(first.account);
    expect(second.providers.providers).toHaveLength(1);
    expect(second.models.models).toHaveLength(1);
    expect(second.config.models).toHaveLength(1);
  });

  it("removes a model's from: entry and its modeModels picks", () => {
    const out = applyAccountSetup(
      {
        providers: { providers: [{ name: "strata", provider: "openai" }] },
        models: {
          models: [{ name: "Qwen", connection: "strata", model: "q" }],
        },
        config: {
          models: [
            { from: "Qwen" },
            { name: "Other", provider: "x", model: "y" },
          ],
          modeModels: { agent: { model: "Qwen", models: ["Qwen", "Other"] } },
        } as any,
      },
      { provider: "openai", remove: ["Qwen"] },
    );
    expect(out.config.models).toEqual([
      { name: "Other", provider: "x", model: "y" },
    ]);
    expect((out.config as any).modeModels).toEqual({
      agent: { model: "Other", models: ["Other"] },
    });
    // The catalog keeps the model, for other configs
    expect(out.models.models).toHaveLength(1);
  });
});

describe("applyConvertToAccount", () => {
  it("moves one connection's inline models to an account and the catalog, keeping names and roles", () => {
    const out = applyConvertToAccount(
      {
        providers: {},
        models: {},
        config: {
          models: [
            {
              name: "Strata plan",
              provider: "openai",
              model: "qwen",
              apiBase: "http://127.0.0.1:8083/v1/",
              apiKey: "${{ secrets.CONTINUED_LOCAL_API_KEY }}",
              roles: ["chat"],
              requestOptions: {
                extraBodyProperties: { reasoning_effort: "xhigh" },
              },
            },
            {
              name: "Elsewhere",
              provider: "openai",
              model: "gpt-x",
            },
          ],
        } as any,
      },
      "openai",
      { apiBase: "http://127.0.0.1:8083/v1" },
      "strata",
    );
    expect(out.converted).toBe(1);
    expect(out.providers.providers).toEqual([
      {
        name: "strata",
        provider: "openai",
        apiBase: "http://127.0.0.1:8083/v1",
        apiKey: "${{ secrets.CONTINUED_LOCAL_API_KEY }}",
      },
    ]);
    expect(out.models.models).toEqual([
      {
        name: "Strata plan",
        connection: "strata",
        model: "qwen",
        requestOptions: { extraBodyProperties: { reasoning_effort: "xhigh" } },
      },
    ]);
    expect(out.config.models).toEqual([
      { from: "Strata plan", roles: ["chat"] },
      { name: "Elsewhere", provider: "openai", model: "gpt-x" },
    ]);
  });
});

describe("describeAccountConnections", () => {
  it("groups from: and connection: models by account, with its key state", () => {
    const connections = describeAccountConnections(
      {
        models: [
          { from: "Qwen#act" },
          { name: "Direct", connection: "strata", model: "other" },
          { from: "Unknown" },
        ],
      } as any,
      [
        {
          name: "strata",
          provider: "openai",
          apiBase: "http://127.0.0.1:8083/v1/",
          apiKey: "${{ secrets.CONTINUED_LOCAL_API_KEY }}",
        },
      ],
      [{ name: "Qwen", connection: "strata", model: "qwen" }],
    );
    expect(connections).toEqual([
      {
        provider: "openai",
        connection: { apiBase: "http://127.0.0.1:8083/v1" },
        account: "strata",
        models: [
          { name: "Qwen#act", model: "qwen" },
          { name: "Direct", model: "other" },
        ],
        key: { state: "secret", secretName: "CONTINUED_LOCAL_API_KEY" },
      },
    ]);
  });
});

describe("catalogEntryFor with reported reasoning efforts", () => {
  it("adds one variant per effort", () => {
    const entry = catalogEntryFor(
      { ...strataModel, reasoningEfforts: ["none", "low", "high"] },
      "strata",
    );
    expect(entry.variants).toEqual({
      none: {
        requestOptions: { extraBodyProperties: { reasoning_effort: "none" } },
      },
      low: {
        requestOptions: { extraBodyProperties: { reasoning_effort: "low" } },
      },
      high: {
        requestOptions: { extraBodyProperties: { reasoning_effort: "high" } },
      },
    });
  });
});
