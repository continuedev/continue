import { defaultBorderRadius } from "..";

export enum ModelProviderTags {
  RequiresApiKey = "Requires API Key",
  Local = "Local",
  Free = "Free",
  OpenSource = "Open-Source",
}

export interface ModelProviderTagProps {
  tag: ModelProviderTags;
}

export const MODEL_PROVIDER_TAG_COLORS = {
  [ModelProviderTags.RequiresApiKey]: "#FF0000",
  [ModelProviderTags.Local]: "#00bb00",
  [ModelProviderTags.OpenSource]: "#0033FF",
  [ModelProviderTags.Free]: "#ffff00",
};

export default function ModelProviderTag({ tag }: ModelProviderTagProps) {
  return (
    <span
      style={{
        fontSize: "0.9em",
        backgroundColor: `${MODEL_PROVIDER_TAG_COLORS[tag]}55`,
        color: "white",
        padding: "2px 4px",
        borderRadius: defaultBorderRadius,
        marginRight: "4px",
      }}
    >
      {tag}
    </span>
  );
}
