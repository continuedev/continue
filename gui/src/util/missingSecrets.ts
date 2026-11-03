import type {
  ConfigErrorAction,
  ConfigValidationError,
} from "@continuedev/config-yaml";
import type { ModelDescription } from "core";
import { LLMConfigurationStatuses } from "core/llm/constants";

export type SetSecretAction = Extract<ConfigErrorAction, { kind: "setSecret" }>;

/** A secret that is referenced by the config but has no value on this machine. */
export interface MissingSecret {
  secretName: string;
  providers: string[];
  modelNames: string[];
}

/** Display names for the providers people are most likely to see here. */
const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
  bedrock: "Amazon Bedrock",
  "bedrock-mantle": "Amazon Bedrock Mantle",
  azure: "Azure OpenAI",
  mistral: "Mistral",
  ollama: "Ollama",
  openrouter: "OpenRouter",
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/** The unset-secret errors in a config error list, as typed actions. */
export function missingSecretsFromErrors(
  errors: ConfigValidationError[] | undefined,
): MissingSecret[] {
  const found = new Map<string, MissingSecret>();
  for (const error of errors ?? []) {
    const action = error.action;
    if (action?.kind !== "setSecret") continue;
    found.set(action.secretName, {
      secretName: action.secretName,
      providers: action.providers,
      modelNames: action.modelNames,
    });
  }
  return [...found.values()];
}

/** Errors that are not about a missing secret (kept for the generic tooltip). */
export function otherErrors(
  errors: ConfigValidationError[] | undefined,
): ConfigValidationError[] {
  return (errors ?? []).filter((e) => e.action?.kind !== "setSecret");
}

export function modelHasMissingSecret(
  model: Pick<ModelDescription, "configurationStatus"> | null | undefined,
): boolean {
  return (
    model?.configurationStatus === LLMConfigurationStatuses.MISSING_ENV_SECRET
  );
}

/**
 * The missing secrets that matter for a given model title: those used by it.
 * With no title, every missing secret.
 */
export function missingSecretsForModel(
  missing: MissingSecret[],
  modelTitle: string | undefined,
): MissingSecret[] {
  if (!modelTitle) return missing;
  return missing.filter((s) => s.modelNames.includes(modelTitle));
}

/** One line for a tooltip: "Anthropic key is not set on this machine". */
export function missingSecretSummary(missing: MissingSecret[]): string {
  if (missing.length === 0) return "";
  const providers = [...new Set(missing.flatMap((m) => m.providers))].map(
    providerLabel,
  );
  if (providers.length === 1) {
    return `${providers[0]} key is not set on this machine`;
  }
  return `${providers.length} API keys are not set on this machine`;
}
