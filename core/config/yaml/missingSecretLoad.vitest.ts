import { renderSecrets } from "@continuedev/config-yaml";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IDE, IdeInfo, ILLMLogger } from "../..";
import * as paths from "../../util/paths";
import { configYamlToContinueConfig } from "./loadYaml";
import { LocalPlatformClient } from "./LocalPlatformClient";

const ide = {
  getWorkspaceDirs: async () => [],
  fileExists: async () => false,
  readFile: async () => "",
  readSecrets: async () => ({}),
  listDir: async () => [],
  getFileResults: async () => "",
  getIdeInfo: async () => ({ ideType: "vscode" }),
} as unknown as IDE;

const ideInfo = { ideType: "vscode" } as unknown as IdeInfo;
const llmLogger = { createInteractionLog: vi.fn() } as unknown as ILLMLogger;

const yaml = (apiKey: string) =>
  [
    "name: t",
    "version: 1.0.0",
    "models:",
    "  - name: Claude",
    "    provider: anthropic",
    "    model: claude-sonnet-4-6",
    `    apiKey: ${apiKey}`,
    "    roles: [chat]",
  ].join("\n");

async function load(text: string) {
  const unrolled = await renderSecrets(
    { uriType: "file", fileUri: "file:///x/config.yaml" } as any,
    text,
    {} as any,
    new LocalPlatformClient(ide),
  );
  return configYamlToContinueConfig({
    unrolledAssistant: unrolled,
    ide,
    ideInfo,
    uniqueId: "test",
    llmLogger,
  });
}

describe("config load with a secret that is not set on this machine", () => {
  const name = "CONTINUED_A0_TEST_KEY";

  afterEach(() => {
    delete process.env[name];
    vi.restoreAllMocks();
  });

  it("reports a non-fatal error with an action, and marks the model", async () => {
    vi.spyOn(paths, "getContinueDotEnv").mockReturnValue({});
    delete process.env[name];

    const { config, errors } = await load(yaml(`\${{ secrets.${name} }}`));

    const secretErrors = errors.filter((e) => e.action?.kind === "setSecret");
    expect(secretErrors).toHaveLength(1);
    expect(secretErrors[0].fatal).toBe(false);
    expect(secretErrors[0].action).toMatchObject({
      secretName: name,
      providers: ["anthropic"],
      modelNames: ["Claude"],
    });

    const [model] = config.modelsByRole.chat;
    expect(model.getConfigurationStatus()).toBe("missing-env-secret");
  });

  it("is silent when the secret comes from the environment", async () => {
    vi.spyOn(paths, "getContinueDotEnv").mockReturnValue({});
    process.env[name] = "sk-from-env";

    const { config, errors } = await load(yaml(`\${{ secrets.${name} }}`));

    expect(errors.filter((e) => e.action)).toEqual([]);
    expect(config.modelsByRole.chat[0].apiKey).toBe("sk-from-env");
    expect(config.modelsByRole.chat[0].getConfigurationStatus()).toBe("valid");
  });

  it("is silent when the secret comes from ~/.continue/.env", async () => {
    vi.spyOn(paths, "getContinueDotEnv").mockReturnValue({
      [name]: "sk-from-dotenv",
    });
    delete process.env[name];

    const { errors } = await load(yaml(`\${{ secrets.${name} }}`));
    expect(errors.filter((e) => e.action)).toEqual([]);
  });

  it("is silent for a literal key", async () => {
    const { errors } = await load(yaml("sk-literal"));
    expect(errors.filter((e) => e.action)).toEqual([]);
  });
});
