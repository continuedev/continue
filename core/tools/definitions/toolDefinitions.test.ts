import { describe, expect, it } from "@jest/globals";
import { ConfigDependentToolParams, GetTool, Tool } from "../..";
import * as toolDefinitions from "./index";

describe("Tool Definitions", () => {
  // Mock params for tools that need them
  const mockParams: ConfigDependentToolParams = {
    rules: [],
    enableExperimentalTools: false,
  };

  // Helper function to get the actual tool object
  const getToolObject = (toolDefinition: Tool | GetTool): Tool => {
    if (typeof toolDefinition === "function") {
      return toolDefinition(mockParams);
    }
    return toolDefinition;
  };

  it("should have all required parameters defined in properties for each tool", () => {
    const exportedTools = Object.values(toolDefinitions);

    exportedTools.forEach((toolDefinition) => {
      const tool = getToolObject(toolDefinition);

      // Each tool should have the required structure
      expect(tool).toHaveProperty("type", "function");
      expect(tool).toHaveProperty("function");
      expect(tool.function).toHaveProperty("parameters");

      const parameters = tool.function.parameters;

      // If there are required parameters, they should be defined in properties
      if (
        parameters &&
        parameters.required &&
        Array.isArray(parameters.required)
      ) {
        expect(parameters).toHaveProperty("properties");
        expect(typeof parameters.properties).toBe("object");

        // Check each required parameter is defined in properties
        parameters.required.forEach((requiredParam: string) => {
          expect(parameters.properties).toHaveProperty(requiredParam);

          // Each property should have at least a type
          const property = parameters.properties[requiredParam];
          expect(property).toHaveProperty("type");
          expect(typeof property.type).toBe("string");
        });
      }
    });
  });
});
