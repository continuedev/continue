export interface ProxyModelName {
  ownerSlug: string;
  packageSlug: string;
  provider: string;
  model: string;
}

export function parseProxyModelName(modelName: string): ProxyModelName {
  const parts = modelName.split("/");

  const [ownerSlug, packageSlug, provider, ...modelParts] = parts;
  const model = modelParts.join("/");

  if (!provider || !model) {
    throw new Error("Invalid model format");
  }

  return { provider, model, ownerSlug, packageSlug };
}
