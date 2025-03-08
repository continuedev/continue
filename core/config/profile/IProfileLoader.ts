// ProfileHandlers manage the loading of a config, allowing us to abstract over different ways of getting to a ContinueConfig

import { ConfigResult } from "@continuedev/config-yaml";
import { ContinueConfig } from "../../index.js";
import { ProfileDescription } from "../ProfileLifecycleManager.js";

// After we have the ContinueConfig, the ConfigHandler takes care of everything else (loading models, lifecycle, etc.)
export interface IProfileLoader {
  description: ProfileDescription;
  doLoadConfig(): Promise<ConfigResult<ContinueConfig>>;
  setIsActive(isActive: boolean): void;
}
