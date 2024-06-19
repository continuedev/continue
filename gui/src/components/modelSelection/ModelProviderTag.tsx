import { defaultBorderRadius } from "..";

export enum ModelProviderTagVals {
  RequiresApiKey = "Requires API Key",
  Local = "Local",
  Free = "Free",
  OpenSource = "Open-Source",
}

export interface ModelProviderTagValsProps {
  tag: ModelProviderTagVals;
}

export const MODEL_PROVIDER_TAG_COLORS = {
  [ModelProviderTagVals.RequiresApiKey]: "#FF0000",
  [ModelProviderTagVals.Local]: "#00bb00",
  [ModelProviderTagVals.OpenSource]: "#0033FF",
  [ModelProviderTagVals.Free]: "#ffff00",
};

export default function ModelProviderTag({ tag }: ModelProviderTagValsProps) {
  return (
    <span
      style={{
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
