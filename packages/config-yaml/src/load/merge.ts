import { BLOCK_TYPES, RequestOptions } from "../browser.js";
import { AssistantUnrolled, ConfigYaml } from "../schemas/index.js";
import { BlockDuplicationDetector } from "./blockDuplicationDetector.js";

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
    env: { ...current.env, ...incoming.env },
    requestOptions: mergeConfigYamlRequestOptions(
      current.requestOptions,
      incoming.requestOptions,
    ),
  };
}

export function mergeUnrolledAssistants(
  current: AssistantUnrolled,
  incoming: AssistantUnrolled,
): AssistantUnrolled {
  const assistant: AssistantUnrolled = {
    ...current,
    env: { ...current.env, ...incoming.env },
    requestOptions: mergeConfigYamlRequestOptions(
      current.requestOptions,
      incoming.requestOptions,
    ),
  };

  const duplicationDetector = new BlockDuplicationDetector();
  for (const blockType of BLOCK_TYPES) {
    const allOfType = [
      ...(incoming[blockType] ?? []),
      ...(current[blockType] ?? []),
    ];
    const deduplicated: typeof allOfType = [];
    for (const block of allOfType) {
      if (block && !duplicationDetector.isDuplicated(block, blockType)) {
        deduplicated.push(block);
      }
    }
    if (deduplicated.length > 0) {
      assistant[blockType] = deduplicated as any;
    } else {
      assistant[blockType] = undefined;
    }
  }

  return assistant;
}

export function mergeConfigYamlRequestOptions(
  base: RequestOptions | undefined,
  global: RequestOptions | undefined,
): RequestOptions | undefined {
  if (!base && !global) {
    return undefined;
  }
  if (!base) {
    return global;
  }
  if (!global) {
    return base;
  }

  const headers = {
    ...global.headers,
    ...base.headers,
  };

  return {
    ...global,
    ...base, // base overrides for simple values as well as noProxy and extraBodyProperties
    headers: Object.keys(headers).length === 0 ? undefined : headers, // headers are the only thing that really merge
  };
}
