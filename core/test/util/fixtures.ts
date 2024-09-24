import { ConfigHandler } from "../../config/ConfigHandler";
import FileSystemIde from "../../util/filesystem";
import { TEST_DIR } from "./testDir";
import { ControlPlaneProviderFactory } from "../../control-plane/provider";

export const testIde = new FileSystemIde(TEST_DIR);

export const ideSettingsPromise = testIde.getIdeSettings();

export const testControlPlaneProvider = ControlPlaneProviderFactory.createProvider(
  Promise.resolve(undefined),
);

export const testConfigHandler = new ConfigHandler(
  testIde,
  ideSettingsPromise,
  async (text) => {},
  testControlPlaneProvider,
);
