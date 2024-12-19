// ProfileHandlers manage the loading of a config, allowing us to abstract over different ways of getting to a ContinueConfig

import {
  ContinueConfig,
  IdeSettings,
} from "../../index.js";
import { ConfigResult } from "../load.js";

// After we have the ContinueConfig, the ConfigHandler takes care of everything else (loading models, lifecycle, etc.)
export interface IProfileLoader {
  profileTitle: string;
  profileId: string;
  doLoadConfig(ideSettingsPromise: Promise<IdeSettings>): Promise<ConfigResult<ContinueConfig>>;
  setIsActive(isActive: boolean): void;
}
