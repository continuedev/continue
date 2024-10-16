// ProfileHandlers manage the loading of a config, allowing us to abstract over different ways of getting to a ContinueConfig

import { ContinueConfig } from "../../index.js";
import { ValidationErrorMessage } from "../validation.js";

// After we have the ContinueConfig, the ConfigHandler takes care of everything else (loading models, lifecycle, etc.)
export interface IProfileLoader {
  profileTitle: string;
  profileId: string;
  doLoadConfig(): Promise<{
    config: ContinueConfig | undefined;
    errors: ValidationErrorMessage[] | undefined;
  }>;
  setIsActive(isActive: boolean): void;
}
