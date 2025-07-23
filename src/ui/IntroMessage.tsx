import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { Box, Text } from "ink";
import React from "react";
import { parseArgs } from "../args.js";
import { getAllSlashCommands } from "../commands/commands.js";
import { MCPService } from "../mcp.js";

interface IntroMessageProps {
  config: AssistantUnrolled;
  model: ModelConfig;
  mcpService: MCPService;
}

const IntroMessage: React.FC<IntroMessageProps> = ({ config, model, mcpService }) => {
  const mcpTools = mcpService.getTools() ?? [];
  const mcpPrompts = mcpService.getPrompts() ?? [];
  
  // Get all slash commands from central definition
  const allCommands = getAllSlashCommands(config);
  
  // Show all rules in a single section
  const args = parseArgs();
  const commandLineRules = args.rules || [];
  const configRules = config.rules?.map((rule: any) => 
    typeof rule === "string" ? rule : rule?.name || "Unknown"
  ) || [];
  
  const allRules = [...commandLineRules, ...configRules];

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {/* Agent name */}
      <Text bold color="yellow">
        Agent: {config.name}
      </Text>
      
      {/* Model */}
      <Text color="blue">
        Model: <Text color="white">{model.name.split("/").pop()}</Text>
      </Text>
      
      <Text> </Text>
      
      {/* Slash commands */}
      <Text color="blue">Slash commands:</Text>
      {allCommands.map((command, index) => (
        <Text key={index}>
          - <Text color="white">/{command.name}</Text>: <Text color="gray">{command.description}</Text>
        </Text>
      ))}
      
      {/* MCP prompts */}
      {mcpPrompts.map((prompt, index) => (
        <Text key={`mcp-${index}`}>
          - <Text color="white">/{prompt.name}</Text>: <Text color="gray">{prompt.description}</Text>
        </Text>
      ))}
      
      <Text> </Text>
      
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
          <Text color="blue">MCP Servers:</Text>
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

export default IntroMessage;