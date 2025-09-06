import { ConfigYaml } from "@continuedev/config-yaml";

export const defaultContextProvidersVsCode: NonNullable<
  ConfigYaml["context"]
>[number][] = [
  { provider: "code" },
  { provider: "docs" },
  { provider: "diff" },
  { provider: "terminal" },
  { provider: "problems" },
];

export const defaultContextProvidersJetBrains: NonNullable<
  ConfigYaml["context"]
>[number][] = [{ provider: "diff" }];

export const defaultConfig: ConfigYaml = {
  name: "Local Agent",
  version: "1.0.0",
  schema: "v1",
  models: [],
};
