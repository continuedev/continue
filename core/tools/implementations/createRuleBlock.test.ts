import * as YAML from "yaml";
import { createRuleBlockImpl } from "./createRuleBlock";

// Mock the extras parameter with necessary functions
const mockIde = {
  getWorkspaceDirs: jest.fn().mockResolvedValue(["/"]),
  writeFile: jest.fn().mockResolvedValue(undefined),
  openFile: jest.fn().mockResolvedValue(undefined),
};

const mockExtras = {
  ide: mockIde,
};

describe("createRuleBlockImpl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a basic rule with name and rule content", async () => {
    const args = {
      name: "Test Rule",
      rule: "Always write tests",
    };

    const result = await createRuleBlockImpl(args, mockExtras as any);

    // Verify that writeFile was called with the correct YAML
    expect(mockIde.writeFile).toHaveBeenCalled();
    const yamlContent = mockIde.writeFile.mock.calls[0][1];
    const parsedYaml = YAML.parse(yamlContent);

    // Verify the structure of the YAML
    expect(parsedYaml).toEqual({
      name: "Test Rule",
      version: "0.0.1",
      schema: "v1",
      rules: [
        {
          name: "Test Rule",
          rule: "Always write tests",
        },
      ],
    });

    // Verify the result
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Rule Block Created");
    expect(result[0].description).toBe("Created Test Rule rule");
  });

  it("should create a rule with glob pattern", async () => {
    const args = {
      name: "TypeScript Rule",
      rule: "Use interfaces for object shapes",
      globs: "**/*.{ts,tsx}",
    };

    await createRuleBlockImpl(args, mockExtras as any);

    // Verify the YAML structure with globs
    const yamlContent = mockIde.writeFile.mock.calls[0][1];
    const parsedYaml = YAML.parse(yamlContent);
    expect(parsedYaml.rules[0]).toEqual({
      name: "TypeScript Rule",
      rule: "Use interfaces for object shapes",
      globs: "**/*.{ts,tsx}",
    });
  });

  it("should create a filename based on sanitized rule name", async () => {
    const args = {
      name: "Special Ch@racters & Spaces",
      rule: "Handle special characters",
    };

    await createRuleBlockImpl(args, mockExtras as any);

    // Check that the filename is sanitized
    const fileUri = mockIde.writeFile.mock.calls[0][0];
    expect(fileUri).toContain("special-chracters-spaces.yaml");
  });
});
