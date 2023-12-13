import { ContinueConfig } from ".";

function modifyConfig(config: ContinueConfig): ContinueConfig {
  config.allowAnonymousTelemetry = false;
  return config;
}
