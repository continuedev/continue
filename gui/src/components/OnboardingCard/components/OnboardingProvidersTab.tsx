import { OnboardingModes } from "core/protocol/core";
import { useState } from "react";
import { providers } from "../../../pages/AddNewModel/configs/providers";
import { Button, Input } from "../../index";
import { useSubmitOnboarding } from "../hooks/useSubmitOnboarding";

export function OnboardingProvidersTab({ isDialog }: { isDialog?: boolean }) {
  const [apiKey, setApiKey] = useState("");
  const { submitOnboarding } = useSubmitOnboarding(
    OnboardingModes.API_KEY,
    isDialog,
  );
  return (
    <div className="mx-auto w-full max-w-md py-4">
      <h2 className="mt-0 text-lg">Connect Vercel AI Gateway</h2>
      <p className="text-description text-sm">
        One API key for chat, editing, autocomplete, and codebase embeddings.
        Model usage is billed to your Vercel Gateway account.
      </p>
      <label htmlFor="gateway-api-key" className="mb-2 block text-sm">
        Gateway API key
      </label>
      <Input
        id="gateway-api-key"
        type="password"
        className="w-full"
        value={apiKey}
        onChange={(event) => setApiKey(event.target.value)}
        placeholder="Enter your Vercel AI Gateway API key"
      />
      <a
        href={providers["vercel-ai-gateway"]!.apiKeyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="my-3 block text-sm underline"
      >
        Create a Gateway API key
      </a>
      <p className="text-description text-xs">
        Connecting replaces legacy provider entries with Gateway defaults. Your
        key is saved in your local Ruckus configuration.
      </p>
      <Button
        className="w-full"
        disabled={!apiKey.trim()}
        onClick={() => submitOnboarding("vercel-ai-gateway", apiKey.trim())}
      >
        Connect Gateway
      </Button>
    </div>
  );
}
