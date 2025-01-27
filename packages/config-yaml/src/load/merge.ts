import { AssistantRolled } from "../schemas/index.js";

export function mergePackages(
  current: AssistantRolled,
  incoming: AssistantRolled,
): AssistantRolled {
  return {
    ...current,
    models: [...(current.models ?? []), ...(incoming.models ?? [])],
    context: [...(current.context ?? []), ...(incoming.context ?? [])],
    data: [...(current.data ?? []), ...(incoming.data ?? [])],
    tools: [...(current.tools ?? []), ...(incoming.tools ?? [])],
    mcpServers: [...(current.mcpServers ?? []), ...(incoming.mcpServers ?? [])],
    rules: [...(current.rules ?? []), ...(incoming.rules ?? [])],
    prompts: [...(current.prompts ?? []), ...(incoming.prompts ?? [])],
    docs: [...(current.docs ?? []), ...(incoming.docs ?? [])],
  };
}
