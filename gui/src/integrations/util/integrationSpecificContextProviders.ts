// Handles all the specific context provider filtering with integrations
// This is a bit ugly but what we're doing with right now due to dependency issues when importing core

import { RootState } from "@/redux/store";
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";

const aiderContextProvidersSpecific = ["relativegitfilecontext"];

const perplexityContextProvidersSpecific = ["file", "terminal", "folder"];

const SPECIFIC_CONTEXT_PROVIDERS_INTEGRATIONS = {
  aider: aiderContextProvidersSpecific,
  perplexity: perplexityContextProvidersSpecific,
};

const SPECIFIC_CONTEXT_PROVIDERS_PATHNAME = {
  "/aiderMode": aiderContextProvidersSpecific,
  "/perplexityMode": perplexityContextProvidersSpecific,
  "/inventory/aiderMode": aiderContextProvidersSpecific,
  "/inventory/perplexityMode": perplexityContextProvidersSpecific,
};

// shouldSkipContextProviders is for the backend
export function shouldSkipContextProviders(
  defaultModelTitle: string | undefined,
  description: { title: string },
): boolean {
  const matchingIntegrationKey = Object.keys(
    SPECIFIC_CONTEXT_PROVIDERS_INTEGRATIONS,
  ).find((key) => defaultModelTitle?.toLowerCase().includes(key));

  if (matchingIntegrationKey) {
    const specificProviders =
      SPECIFIC_CONTEXT_PROVIDERS_INTEGRATIONS[matchingIntegrationKey];
    // Return to skip if the requested title of provider is not in the specificProviders
    return !specificProviders.some(
      (provider) => provider === description.title,
    );
  }

  // For all other models,  skip if "relativefilecontext" or "relativegitfilecontext" is in the title
  return description.title === "relativefilecontext" || description.title ===  "relativegitfilecontext";
}

// This is for the frontend UI, which context providers are provided
export function getContextProviders() {
  let location = useLocation();
  let pathname = location.pathname;
  let availableContextProviders = useSelector(
    (store: RootState) => store.state.config.contextProviders,
  );

  return useMemo(() => {
    // Check if pathname has specific context providers
    if (pathname in SPECIFIC_CONTEXT_PROVIDERS_PATHNAME) {
      const specificProviders = SPECIFIC_CONTEXT_PROVIDERS_PATHNAME[pathname];
      return availableContextProviders.filter((provider) =>
        specificProviders.includes(provider.title),
      );
    }

    // Default filtering logic, just filter out "relativefilecontext" and "relativegitfilecontext"
    return availableContextProviders.filter(
      (provider) => provider.title !== "relativefilecontext" && provider.title !== "relativegitfilecontext",
    );
  }, [pathname, availableContextProviders]);
}
