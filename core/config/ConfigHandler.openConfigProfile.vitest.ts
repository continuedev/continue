import { describe, expect, it, vi } from "vitest";

import { ConfigHandler } from "./ConfigHandler";
import { getConfigYamlPath } from "../util/paths.js";

vi.mock("../util/paths.js", async () => {
  const actual =
    await vi.importActual<typeof import("../util/paths.js")>(
      "../util/paths.js",
    );
  return {
    ...actual,
    getConfigYamlPath: vi.fn(() => "file:///global/config.yaml"),
  };
});

describe("ConfigHandler.openConfigProfile", () => {
  it("opens workspace-local source files without touching the global config path", async () => {
    const ide = {
      openFile: vi.fn(),
      openUrl: vi.fn(),
      getIdeSettings: vi.fn(),
    };

    const handler = Object.assign(Object.create(ConfigHandler.prototype), {
      ide,
      currentProfile: {
        profileDescription: {
          id: "local-profile",
          profileType: "local",
          uri: "file:///global/config.yaml",
        },
      },
      currentOrg: {
        profiles: [
          {
            profileDescription: {
              id: "local-profile",
              profileType: "local",
              uri: "file:///global/config.yaml",
            },
          },
        ],
      },
    }) as Pick<ConfigHandler, "openConfigProfile"> & {
      ide: typeof ide;
      currentProfile: {
        profileDescription: {
          id: string;
          profileType: string;
          uri: string;
        };
      };
      currentOrg: {
        profiles: Array<{
          profileDescription: {
            id: string;
            profileType: string;
            uri: string;
          };
        }>;
      };
    };

    await handler.openConfigProfile("local-profile", {
      sourceFile: "file:///workspace/.continue/config.yaml",
    });

    expect(ide.openFile).toHaveBeenCalledWith(
      "file:///workspace/.continue/config.yaml",
    );
    expect(getConfigYamlPath).not.toHaveBeenCalled();
  });
});
