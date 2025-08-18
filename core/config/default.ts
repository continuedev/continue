import { ConfigYaml } from "@continuedev/config-yaml";

export const defaultContextProvidersJetBrains: NonNullable<
  ConfigYaml["context"]
>[number][] = [
  { provider: "diff" },
  { provider: "folder" },
  { provider: "codebase" },
];

export const defaultConfig: ConfigYaml = {
  name: "Local Assistant",
  version: "1.0.0",
  schema: "v1",
  models: [],
};

export const defaultConfigJetBrains: ConfigYaml = {
  name: "Local Assistant",
  version: "1.0.0",
  schema: "v1",
  models: [],
};
