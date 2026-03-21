import { afterEach, describe, expect, it, jest } from "@jest/globals";
import fs from "fs";

const mockParseConfigYaml = jest.fn();

jest.mock("@continuedev/config-yaml", () => ({
  parseConfigYaml: mockParseConfigYaml,
}));

import LocalProfileLoader from "./LocalProfileLoader";

describe("LocalProfileLoader", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockParseConfigYaml.mockReset();
  });

  it("uses name from default local config.yaml when available", () => {
    jest.spyOn(fs, "readFileSync").mockReturnValue("config content" as any);
    mockParseConfigYaml.mockReturnValue({ name: "My Custom Config" } as any);

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
    jest.spyOn(fs, "readFileSync").mockReturnValue("config content" as any);
    mockParseConfigYaml.mockReturnValue({} as any);

    const loader = new LocalProfileLoader({} as any, {} as any, {} as any);

    expect(loader.description.title).toBe("Local Config");
  });

  it("prefers override assistant content name when override file is provided", () => {
    const readSpy = jest.spyOn(fs, "readFileSync");
    mockParseConfigYaml.mockReturnValue({ name: "Workspace Agent" } as any);

    const loader = new LocalProfileLoader(
      {} as any,
      {} as any,
      {} as any,
      {
        path: "file:///tmp/custom.yaml",
        content: "config content",
      },
    );

    expect(loader.description.title).toBe("Workspace Agent");
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("does not fall back to the primary config when override content is empty", () => {
    const readSpy = jest.spyOn(fs, "readFileSync");

    const loader = new LocalProfileLoader(
      {} as any,
      {} as any,
      {} as any,
      {
        path: "file:///tmp/empty.yaml",
        content: "",
      },
    );

    expect(loader.description.title).toBe("empty.yaml");
    expect(readSpy).not.toHaveBeenCalled();
  });
});
