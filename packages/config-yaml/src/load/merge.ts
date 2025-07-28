import { AssistantUnrolled, ConfigYaml } from "../schemas/index.js";

export function mergePackages(
  current: ConfigYaml,
  incoming: ConfigYaml,
): ConfigYaml {
  return {
    ...current,
    models: [...(current.models ?? []), ...(incoming.models ?? [])],
    context: [...(current.context ?? []), ...(incoming.context ?? [])],
    data: [...(current.data ?? []), ...(incoming.data ?? [])],
    mcpServers: [...(current.mcpServers ?? []), ...(incoming.mcpServers ?? [])],
    rules: [...(current.rules ?? []), ...(incoming.rules ?? [])],
    prompts: [...(current.prompts ?? []), ...(incoming.prompts ?? [])],
    docs: [...(current.docs ?? []), ...(incoming.docs ?? [])],
  };
}

export function mergeUnrolledAssistants(
  current: AssistantUnrolled,
  incoming: AssistantUnrolled,
): AssistantUnrolled {
  return {
    ...current,
    rules: [...(current.rules ?? []), ...(incoming.rules ?? [])],
    models: [...(current.models ?? []), ...(incoming.models ?? [])],
    docs: [...(current.docs ?? []), ...(incoming.docs ?? [])],
    context: [...(current.context ?? []), ...(incoming.context ?? [])],
    data: [...(current.data ?? []), ...(incoming.data ?? [])],
    mcpServers: [...(current.mcpServers ?? []), ...(incoming.mcpServers ?? [])],
    prompts: [...(current.prompts ?? []), ...(incoming.prompts ?? [])],
  };
}
