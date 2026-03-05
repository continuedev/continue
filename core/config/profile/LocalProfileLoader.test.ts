import { describe, expect, it, jest, afterEach } from "@jest/globals";
import fs from "fs";

import LocalProfileLoader from "./LocalProfileLoader";

describe("LocalProfileLoader", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses name from default local config.yaml when available", () => {
    jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue("name: My Custom Config\nmodels: []\n" as any);

    const loader = new LocalProfileLoader({} as any, {} as any, {} as any);

    expect(loader.description.title).toBe("My Custom Config");
  });

  it("falls back to Local Config when default config file is missing", () => {
    jest.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const loader = new LocalProfileLoader({} as any, {} as any, {} as any);

    expect(loader.description.title).toBe("Local Config");
  });

  it("keeps Local Config title when config has no name field", () => {
    jest.spyOn(fs, "readFileSync").mockReturnValue("models: []\n" as any);

    const loader = new LocalProfileLoader({} as any, {} as any, {} as any);

    expect(loader.description.title).toBe("Local Config");
  });

  it("prefers override assistant content name when override file is provided", () => {
    const readSpy = jest.spyOn(fs, "readFileSync");

    const loader = new LocalProfileLoader(
      {} as any,
      {} as any,
      {} as any,
      {
        path: "file:///tmp/custom.yaml",
        content: "name: Workspace Agent\nmodels: []\n",
      },
    );

    expect(loader.description.title).toBe("Workspace Agent");
    expect(readSpy).not.toHaveBeenCalled();
  });
});
