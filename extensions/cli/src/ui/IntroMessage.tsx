import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { Box, Text } from "ink";
import React, { useMemo } from "react";

import { getDisplayableAsciiArt } from "../asciiArt.js";
import { MCPService } from "../services/MCPService.js";
import { isModelCapable } from "../utils/modelCapability.js";

import { ModelCapabilityWarning } from "./ModelCapabilityWarning.js";

interface IntroMessageProps {
  config?: AssistantUnrolled;
  model?: ModelConfig;
  mcpService?: MCPService;
}

const IntroMessage: React.FC<IntroMessageProps> = ({
  config,
  model,
  mcpService,
}) => {
  // Get MCP prompts directly (not memoized since they can change after first render)
  const mcpPrompts = mcpService?.getState().prompts ?? [];

  // Memoize expensive operations to avoid running on every resize
  const { allRules, modelCapable } = useMemo(() => {
    // Show all rules from config (command-line rules are already merged into config)
    const configRules =
      config?.rules?.map((rule: any) =>
        typeof rule === "string" ? rule : rule?.name || "Unknown",
      ) || [];

    const allRules = configRules;

    // Check if model is capable - now checking both name and model properties
    const modelCapable = model
      ? isModelCapable(model.provider, model.name, model.model)
      : true; // Default to true if model not loaded yet

    return { allRules, modelCapable };
  }, [config?.rules, model?.provider, model?.name, model?.model]);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {/* ASCII Art */}
      <Text>{getDisplayableAsciiArt()}</Text>
      <Text> </Text>

      {/* Agent name */}
      {config && (
        <Text color="blue">
          <Text bold>Agent:</Text> <Text color="white">{config.name}</Text>
        </Text>
      )}

      {/* Model */}
      {model ? (
        <Text color="blue">
          <Text bold>Model:</Text>{" "}
          <Text color="white">{model.name.split("/").pop()}</Text>
        </Text>
      ) : (
        <Text color="blue">
          <Text bold>Model:</Text> <Text color="gray">Loading...</Text>
        </Text>
      )}

      <Text> </Text>

      {/* Model capability warning */}
      {model && !modelCapable && (
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
          <Text bold color="blue">
            Rules:
          </Text>
          {allRules.map((rule, index) => (
            <Text key={index}>
              - <Text color="white">{rule}</Text>
            </Text>
          ))}
          <Text> </Text>
        </>
      )}

      {/* MCP Servers */}
      {(config?.mcpServers?.length ?? 0) > 0 && (
        <>
          <Text bold color="blue">
            MCP Servers:
          </Text>
          {config?.mcpServers?.map((server: any, index: number) => (
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
