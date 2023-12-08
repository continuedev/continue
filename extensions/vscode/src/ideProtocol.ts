import { IDE } from "../../../core/ide/types";
import * as fs from "fs";
import { getConfigJsonPath } from "./activation/environmentSetup";

class VsCodeIde implements IDE {
  getSerializedConfig() {
    const configPath = getConfigJsonPath();
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config;
  }
}
