import { ModelPackage } from "../pages/AddNewModel/configs/models";

interface BuildAddedModelArgs {
  /** Provider the user picked in the form. */
  provider: string;
  providerParams: Record<string, any>;
  /** Undefined when the provider has no packages, e.g. a live catalog that could not be read. */
  selectedModel: ModelPackage | undefined;
  /** Model id typed by the user when there is no package to pick. */
  typedModel?: string;
  /** Values of the provider's input fields. */
  inputs: Record<string, any>;
  apiKey?: string;
}

/**
 * The model entry written to the config. A package may name the provider that runs it
 * (`params.provider`, e.g. Claude served by DotHoosh runs on the anthropic provider); otherwise
 * the picked provider is used. Without a package the typed model id is used.
 */
export function buildAddedModel({
  provider,
  providerParams,
  selectedModel,
  typedModel,
  inputs,
  apiKey,
}: BuildAddedModelArgs): Record<string, any> | undefined {
  const typed = typedModel?.trim();
  if (!selectedModel && !typed) {
    return undefined;
  }

  const packageParams = selectedModel?.params ?? {
    model: typed!,
    title: typed,
  };
  return {
    ...providerParams,
    ...packageParams,
    ...inputs,
    provider: packageParams.provider ?? provider,
    title: selectedModel?.title ?? typed!,
    ...(apiKey ? { apiKey } : {}),
  };
}
