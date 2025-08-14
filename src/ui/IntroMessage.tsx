import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { Box, Text } from "ink";
import React from "react";

import { parseArgs } from "../args.js";
import { MCPService } from "../mcp.js";
import { isModelCapable } from "../utils/modelCapability.js";

import { ModelCapabilityWarning } from "./ModelCapabilityWarning.js";

interface IntroMessageProps {
  config: AssistantUnrolled;
  model: ModelConfig;
  mcpService: MCPService;
}

const IntroMessage: React.FC<IntroMessageProps> = ({
  config,
  model,
  mcpService,
}) => {
  const mcpPrompts = mcpService.getPrompts() ?? [];


  // Show all rules in a single section
  const args = parseArgs();
  const commandLineRules = args.rules || [];
  const configRules =
    config.rules?.map((rule: any) =>
      typeof rule === "string" ? rule : rule?.name || "Unknown",
    ) || [];

  const allRules = [...commandLineRules, ...configRules];

  // Check if model is capable - now checking both name and model properties
  const modelCapable = isModelCapable(model.provider, model.name, model.model);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {/* Agent name */}
      <Text color="blue">
        <Text bold>Agent:</Text> <Text color="white">{config.name}</Text>
      </Text>

      {/* Model */}
      <Text color="blue">
        <Text bold>Model:</Text>{" "}
        <Text color="white">{model.name.split("/").pop()}</Text>
      </Text>

      <Text> </Text>

      {/* Model capability warning */}
      {!modelCapable && (
        <>
          <ModelCapabilityWarning
            modelName={model.name.split("/").pop() || model.name}
          />
          <Text> </Text>
        </>
      )}

      {/* MCP prompts */}
      {mcpPrompts.length > 0 && (
        <>
          {mcpPrompts.map((prompt, index) => (
            <Text key={`mcp-${index}`}>
              - <Text color="white">/{prompt.name}</Text>:{" "}
              <Text color="gray">{prompt.description}</Text>
            </Text>
          ))}
          <Text> </Text>
        </>
      )}

      {/* Rules */}
      {allRules.length > 0 && (
        <>
          <Text color="blue">Rules:</Text>
          {allRules.map((rule, index) => (
            <Text key={index}>
              - <Text color="white">{rule}</Text>
            </Text>
          ))}
          <Text> </Text>
        </>
      )}

      {/* MCP Servers */}
      {config.mcpServers?.length && (
        <>
          <Text bold color="blue">
            MCP Servers:
          </Text>
          {config.mcpServers.map((server: any, index: number) => (
            <Text key={index}>
              - <Text color="white">{server?.name}</Text>
            </Text>
          ))}
          <Text> </Text>
        </>
      )}
    </Box>
  );
};

export { IntroMessage };
