import { BaseApiKey } from "./BaseApiKey";

export const ApiKeysInputs = () => {
  return (
    <div>
      <BaseApiKey
        provider={{ value: "openai", label: "OpenAI" }}
        docsUrl="https://platform.openai.com/account/api-keys"
      />
      <BaseApiKey
        provider={{ value: "anthropic", label: "Anthropic" }}
        docsUrl="https://console.anthropic.com/account/keys"
      />
      <BaseApiKey
        provider={{ value: "google", label: "Google" }}
        docsUrl="https://aistudio.google.com/app/apikey"
      />
      <BaseApiKey
        provider={{ value: "mistral", label: "Mistral" }}
        docsUrl="https://console.mistral.ai/api-keys"
      />
      <BaseApiKey
        provider={{ value: "perplexity", label: "Perplexity" }}
        docsUrl="https://www.perplexity.ai/settings/api"
      />
    </div>
  );
};
