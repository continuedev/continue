import { providers } from "../pages/AddNewModel/configs/providers";

export const popularProviderTitles = [
  providers["openai"]?.title || "",
  providers["anthropic"]?.title || "",
  providers["mistral"]?.title || "",
  providers["gemini"]?.title || "",
  providers["azure"]?.title || "",
  providers["ollama"]?.title || "",
  providers["deepseek"]?.title || "",
].filter(Boolean);

export const getSortedProviders = () => {
  const allProviders = Object.entries(providers)
    .filter(([key]) => !["freetrial", "openai-aiohttp"].includes(key))
    .map(([, provider]) => provider)
    .filter((provider) => !!provider)
    .map((provider) => provider!);

  const popularProviders = allProviders
    .filter((provider) => popularProviderTitles.includes(provider.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  const otherProviders = allProviders
    .filter((provider) => !popularProviderTitles.includes(provider.title))
    .sort((a, b) => a.title.localeCompare(b.title));

  return { popularProviders, otherProviders };
};
