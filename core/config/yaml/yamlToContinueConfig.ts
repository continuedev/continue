import {
  MCPServer,
  mergeConfigYamlRequestOptions,
  RequestOptions,
  Rule,
} from "@continuedev/config-yaml";
import {
  InternalMcpOptions,
  InternalSseMcpOptions,
  InternalStdioMcpOptions,
  InternalStreamableHttpMcpOptions,
  RuleWithSource,
} from "../..";

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

export function convertYamlMcpConfigToInternalMcpOptions(
  config: MCPServer,
  globalRequestOptions?: RequestOptions,
): InternalMcpOptions {
  const { connectionTimeout, faviconUrl, name } = config;
  const base = {
    id: name,
    name,
    faviconUrl: faviconUrl,
    timeout: connectionTimeout,
  };
  // Stdio
  if ("command" in config) {
    const { args, command, cwd, env, type } = config;
    const stdioOptions: InternalStdioMcpOptions = {
      type,
      command,
      args,
      cwd,
      env,
      ...base,
    };
    return stdioOptions;
  }
  // HTTP/SSE
  const { type, url, requestOptions } = config;
  const httpSseConfig:
    | InternalStreamableHttpMcpOptions
    | InternalSseMcpOptions = {
    type,
    url,
    requestOptions: mergeConfigYamlRequestOptions(
      requestOptions,
      globalRequestOptions,
    ),
    ...base,
  };
  return httpSseConfig;
}
