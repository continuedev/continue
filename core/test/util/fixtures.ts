import { ConfigHandler } from "../../config/ConfigHandler";
import { ControlPlaneClient } from "../../control-plane/client";
import FileSystemIde from "../../util/filesystem";

import { TEST_DIR } from "./testDir";

export const testIde = new FileSystemIde(TEST_DIR);

export const ideSettingsPromise = testIde.getIdeSettings();

export const testControlPlaneClient = new ControlPlaneClient(
  Promise.resolve(undefined),
);

export const testConfigHandler = new ConfigHandler(
  testIde,
  ideSettingsPromise,
  async (text) => {},
  testControlPlaneClient,
);
