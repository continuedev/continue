import * as YAML from "yaml";
import { describe, expect, it } from "vitest";

import {
  configFileSlug,
  createConfigFile,
  newConfigTemplate,
  renameConfigFile,
  setConfigName,
  validateConfigName,
} from "./profileFiles";

function memoryIde(files: Record<string, string> = {}) {
  return {
    files,
    getWorkspaceDirs: async () => ["file:///ws"],
    fileExists: async (uri: string) => uri in files,
    readFile: async (uri: string) => {
      if (!(uri in files)) throw new Error(`no ${uri}`);
      return files[uri];
    },
    writeFile: async (uri: string, text: string) => {
      files[uri] = text;
    },
    removeFile: async (uri: string) => {
      delete files[uri];
    },
  };
}

describe("config files", () => {
  it("makes a file name from a config name", () => {
    expect(configFileSlug("Cloud (Anthropic + xAI)")).toBe(
      "cloud-anthropic-xai",
    );
    expect(configFileSlug("Café local")).toBe("cafe-local");
    expect(configFileSlug("!!!")).toBe("config");
  });

  it("writes a template with no API keys that parses as a config", () => {
    const parsed = YAML.parse(newConfigTemplate('Local "fast"'));
    expect(parsed).toEqual({
      name: 'Local "fast"',
      version: "1.0.0",
      schema: "v1",
      models: [],
    });
    expect(newConfigTemplate("x")).not.toMatch(/apiKey/);
  });

  it("creates a workspace config without overwriting one of the same name", async () => {
    const ide = memoryIde({ "file:///ws/.continuous/configs/local.yaml": "x" });
    const uri = await createConfigFile(ide as any, {
      name: "Local",
      location: "workspace",
    });
    expect(uri).toBe("file:///ws/.continuous/configs/local-1.yaml");
    expect(YAML.parse(ide.files[uri]).name).toBe("Local");
    expect(ide.files["file:///ws/.continuous/configs/local.yaml"]).toBe("x");
  });

  it("duplicates a config under a new name, keeping its comments", async () => {
    const ide = memoryIde();
    const uri = await createConfigFile(ide as any, {
      name: "Cloud copy",
      location: "workspace",
      content: "# mine\nname: Cloud\nversion: 1.0.0\nschema: v1\nmodels: []\n",
    });
    expect(ide.files[uri]).toContain("# mine");
    expect(YAML.parse(ide.files[uri]).name).toBe("Cloud copy");
  });

  it("renames a config file along with its name", async () => {
    const old = "file:///ws/.continuous/configs/new-config.yaml";
    const ide = memoryIde({ [old]: "name: New\nversion: 1.0.0\nschema: v1\n" });
    const uri = await renameConfigFile(ide as any, old, "Cloud", {
      moveFile: true,
    });
    expect(uri).toBe("file:///ws/.continuous/configs/cloud.yaml");
    expect(old in ide.files).toBe(false);
    expect(YAML.parse(ide.files[uri]).name).toBe("Cloud");
  });

  it("keeps the file when only the name changes, or when told to", async () => {
    const main = "file:///home/u/.continuous/config.yaml";
    const ide = memoryIde({ [main]: "name: Main\n" });
    expect(
      await renameConfigFile(ide as any, main, "Everyday", { moveFile: false }),
    ).toBe(main);
    expect(ide.files[main]).toBe("name: Everyday\n");

    const cloud = "file:///ws/.continuous/configs/cloud.yaml";
    ide.files[cloud] = "name: cloud\n";
    expect(
      await renameConfigFile(ide as any, cloud, "Cloud", { moveFile: true }),
    ).toBe(cloud);
    expect(ide.files[cloud]).toBe("name: Cloud\n");
  });

  it("refuses to edit unparseable YAML", () => {
    expect(() => setConfigName("name: [", "x")).toThrow(/could not be read/);
  });

  it("validates names", () => {
    expect(validateConfigName("  ")).toMatch(/name/);
    expect(validateConfigName("a\nb")).toMatch(/one line/);
    expect(validateConfigName("Cloud")).toBeUndefined();
  });
});
