import { MCPServer, Rule } from "@continuedev/config-yaml";
import { ExperimentalMCPOptions, RuleWithSource } from "../..";

export function convertYamlRuleToContinueRule(rule: Rule): RuleWithSource {
  if (typeof rule === "string") {
    return {
      rule: rule,
      source: "rules-block",
    };
  } else {
    return {
      source: "rules-block",
      rule: rule.rule,
      globs: rule.globs,
      name: rule.name,
      description: rule.description,
      ruleFile: rule.sourceFile,
      alwaysApply: rule.alwaysApply,
      invokable: rule.invokable ?? false,
    };
  }
}

export function convertYamlMcpToContinueMcp(
  server: MCPServer,
): ExperimentalMCPOptions {
  return {
    transport: {
      type: "stdio",
      command: server.command,
      args: server.args ?? [],
      env: server.env,
      cwd: server.cwd,
    } as any, // TODO: Fix the mcpServers types in config-yaml (discriminated union)
    timeout: server.connectionTimeout,
  };
}
