import { completionParamsInputs } from "../pages/AddNewModel/configs/completionParamsInputs";
import type { ModelPackage } from "../pages/AddNewModel/configs/models";
import type {
  InputDescriptor,
  ProviderInfo,
} from "../pages/AddNewModel/configs/providers";

export type FormValues = Record<string, any>;

const completionParamKeys = new Set(
  Object.values(completionParamsInputs).map((input) => input.key),
);

/** Current value of a field, falling back to its declared default. */
export function resolveValue(field: InputDescriptor, values: FormValues) {
  const v = values[field.key];
  return v === undefined ? field.defaultValue : v;
}

/** A field is visible unless its `showWhen` condition is not met. */
export function isFieldVisible(
  field: InputDescriptor,
  values: FormValues,
  allFields: InputDescriptor[],
): boolean {
  if (!field.showWhen) return true;
  const controller = allFields.find((f) => f.key === field.showWhen!.key);
  const current = controller
    ? resolveValue(controller, values)
    : values[field.showWhen.key];
  return current === field.showWhen.equals;
}

/**
 * Fields the generic part of the form renders (the legacy API key block and the
 * completion-parameter inputs are handled elsewhere). Optional fields only
 * appear when they are selects, conditional, or marked `showAlways`.
 */
export function getRenderableFields(
  provider: ProviderInfo,
  values: FormValues,
): InputDescriptor[] {
  const all = provider.collectInputFor ?? [];
  return all.filter((field) => {
    if (completionParamKeys.has(field.key)) return false;
    // plain apiKey is rendered by the dedicated API key block
    if (field.key === "apiKey" && !field.showWhen) return false;
    if (!isFieldVisible(field, values, all)) return false;
    return (
      !!field.required ||
      field.inputType === "select" ||
      !!field.showWhen ||
      !!field.showAlways
    );
  });
}

/** True when every visible required field has a value. */
export function areRequiredFieldsFilled(
  provider: ProviderInfo,
  values: FormValues,
): boolean {
  const all = provider.collectInputFor ?? [];
  return all
    .filter((f) => f.required && isFieldVisible(f, values, all))
    .every((f) => {
      const v = resolveValue(f, values);
      return v !== undefined && v !== null && String(v).length > 0;
    });
}

/** Assemble the model object sent to `config/addModel`. */
export function buildModelFromForm(
  provider: ProviderInfo,
  selectedModel: ModelPackage,
  values: FormValues,
  options: { title?: string } = {},
  // Loosely typed like the original inline code: provider/model params are free-form.
): any {
  const all = provider.collectInputFor ?? [];
  const fields: Record<string, any> = {};

  for (const input of all) {
    if (input.uiOnly) continue;
    if (!isFieldVisible(input, values, all)) continue;
    const value = resolveValue(input, values);
    // An empty optional field must not hide what the model itself says,
    // such as the context window a live model list reported.
    if (value === undefined) continue;
    const hasNewStyleRules =
      input.showWhen !== undefined || input.omitWhen !== undefined;
    if (hasNewStyleRules) {
      if (value === undefined || value === input.omitWhen) continue;
      if (value === "") continue;
    }
    fields[input.key] = value;
  }

  const apiKeyField = all.find((f) => f.key === "apiKey");
  const apiKeyAllowed =
    !apiKeyField || isFieldVisible(apiKeyField, values, all);
  const apiKey = values["apiKey"];
  const hasValidApiKey = apiKeyAllowed && apiKey !== undefined && apiKey !== "";

  return {
    ...provider.params,
    ...selectedModel.params,
    ...fields,
    provider: provider.provider,
    title: options.title ?? selectedModel.title,
    ...(hasValidApiKey ? { apiKey } : {}),
  };
}

const BEDROCK_CONNECTION_KEYS = [
  "region",
  "apiKey",
  "apiBase",
  "profile",
  "accessKeyId",
  "secretAccessKey",
  "sessionToken",
  "crossRegionInference",
  "serviceTier",
  "latency",
  "guardrailIdentifier",
  "guardrailVersion",
  "mantlePathPrefix",
  "maxTokensParam",
] as const;

/** Connection settings (no title/model) to send for "Test connection". */
export function getBedrockConnectionParams(
  provider: ProviderInfo,
  selectedModel: ModelPackage,
  values: FormValues,
): Record<string, string> {
  const model = buildModelFromForm(provider, selectedModel, values);
  const params: Record<string, string> = {};
  for (const key of BEDROCK_CONNECTION_KEYS) {
    if (typeof model[key] === "string" && model[key] !== "") {
      params[key] = model[key];
    }
  }
  if (provider.provider === "bedrock-mantle") {
    params.endpoint = "mantle";
  }
  return params;
}
