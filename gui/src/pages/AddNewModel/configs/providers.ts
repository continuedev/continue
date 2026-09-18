import { HTMLInputTypeAttribute } from "react";
import { ModelProviderTags } from "../../../components/modelSelection/utils";
import type { ModelPackage } from "./models";

export interface InputDescriptor {
  inputType: HTMLInputTypeAttribute;
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string | number;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  required?: boolean;
  description?: string;
  [key: string]: any;
}

export interface ProviderInfo {
  title: string;
  icon?: string;
  provider: string;
  description: string;
  longDescription?: string;
  tags?: ModelProviderTags[];
  packages: ModelPackage[];
  popularPackages?: ModelPackage[];
  params?: any;
  collectInputFor?: InputDescriptor[];
  refPage?: string;
  apiKeyUrl?: string;
  downloadUrl?: string;
}

export const ollamaStaticModels: ModelPackage[] = [];
export const providers: Partial<Record<string, ProviderInfo>> = {
  "vercel-ai-gateway": {
    title: "Vercel AI Gateway",
    provider: "vercel-ai-gateway",
    description: "All models, one Gateway API key.",
    apiKeyUrl: "https://vercel.com/d?to=%2F%5Bteam%5D%2Fai-gateway%2Fapi-keys",
    tags: [ModelProviderTags.RequiresApiKey],
    packages: [],
  },
};
