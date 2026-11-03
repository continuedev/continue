import { BLOCK_TYPES, RequestOptions } from "../browser.js";
import {
  AssistantUnrolled,
  ConfigYaml,
  ToolPermissions,
} from "../schemas/index.js";
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
    ...(current.modeModels || incoming.modeModels
      ? { modeModels: { ...current.modeModels, ...incoming.modeModels } }
      : {}),
    ...mergeToolPermissionsField(current, incoming),
    requestOptions: mergeConfigYamlRequestOptions(
      current.requestOptions,
      incoming.requestOptions,
    ),
  };
}

/**
 * Rules from both sides apply. Lists are concatenated, never replaced, so a
 * shared config cannot silently drop a deny rule from a personal one (or the
 * other way round). Order does not matter: deny beats ask beats allow.
 */
export function mergeToolPermissions(
  current: ToolPermissions | undefined,
  incoming: ToolPermissions | undefined,
): ToolPermissions | undefined {
  if (!current && !incoming) return undefined;
  const merged: ToolPermissions = {};
  for (const kind of ["allow", "ask", "deny"] as const) {
    const list = [...(current?.[kind] ?? []), ...(incoming?.[kind] ?? [])];
    const unique = list.filter((r, i) => list.indexOf(r) === i);
    if (unique.length > 0) merged[kind] = unique;
  }
  const auto = mergeAuto(current?.auto, incoming?.auto);
  if (auto) merged.auto = auto;
  return Object.keys(merged).length > 0 ? merged : undefined;
}

type AutoSettings = NonNullable<ToolPermissions["auto"]>;

function unionList(a?: string[], b?: string[]): string[] | undefined {
  const list = [...(a ?? []), ...(b ?? [])];
  const unique = list.filter((r, i) => list.indexOf(r) === i);
  return unique.length > 0 ? unique : undefined;
}

function smaller(a?: number, b?: number): number | undefined {
  return a === undefined ? b : b === undefined ? a : Math.min(a, b);
}

/**
 * Lists are concatenated; for the refusal limits the lower number wins, so a
 * shared config cannot raise a limit a personal config set (or the reverse).
 */
function mergeAuto(
  a: AutoSettings | undefined,
  b: AutoSettings | undefined,
): AutoSettings | undefined {
  if (!a && !b) return undefined;
  const out: AutoSettings = {};
  const trusted = unionList(
    a?.environment?.trustedDomains,
    b?.environment?.trustedDomains,
  );
  const markers = unionList(
    a?.environment?.productionMarkers,
    b?.environment?.productionMarkers,
  );
  if (trusted || markers) {
    out.environment = {
      ...(trusted ? { trustedDomains: trusted } : {}),
      ...(markers ? { productionMarkers: markers } : {}),
    };
  }
  const block = unionList(a?.guidance?.block, b?.guidance?.block);
  const allow = unionList(a?.guidance?.allow, b?.guidance?.allow);
  if (block || allow) {
    out.guidance = {
      ...(block ? { block } : {}),
      ...(allow ? { allow } : {}),
    };
  }
  const consecutive = smaller(
    a?.limits?.consecutiveDenials,
    b?.limits?.consecutiveDenials,
  );
  const total = smaller(a?.limits?.totalDenials, b?.limits?.totalDenials);
  if (consecutive !== undefined || total !== undefined) {
    out.limits = {
      ...(consecutive !== undefined ? { consecutiveDenials: consecutive } : {}),
      ...(total !== undefined ? { totalDenials: total } : {}),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mergeToolPermissionsField(
  current: { toolPermissions?: ToolPermissions },
  incoming: { toolPermissions?: ToolPermissions },
): { toolPermissions?: ToolPermissions } {
  const merged = mergeToolPermissions(
    current.toolPermissions,
    incoming.toolPermissions,
  );
  return merged ? { toolPermissions: merged } : {};
}

export function mergeUnrolledAssistants(
  current: AssistantUnrolled,
  incoming: AssistantUnrolled,
): AssistantUnrolled {
  const assistant: AssistantUnrolled = {
    ...current,
    env: { ...current.env, ...incoming.env },
    ...(current.modeModels || incoming.modeModels
      ? { modeModels: { ...current.modeModels, ...incoming.modeModels } }
      : {}),
    ...mergeToolPermissionsField(current, incoming),
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
