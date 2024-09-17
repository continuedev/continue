export enum ModelProviderTags {
  RequiresApiKey = "Requires API Key",
  Local = "Local",
  Free = "Free",
  OpenSource = "Open-Source",
}

export const MODEL_PROVIDER_TAG_COLORS = {
  [ModelProviderTags.RequiresApiKey]: "#FF0000",
  [ModelProviderTags.Local]: "#00bb00",
  [ModelProviderTags.OpenSource]: "#0033FF",
  [ModelProviderTags.Free]: "#ffff00",
};
