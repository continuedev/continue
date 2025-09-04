import { LLMOptions } from "../../index.js";
import { osModelsEditPrompt } from "../templates/edit.js";

import OpenAI from "./OpenAI.js";

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

class OpenRouter extends OpenAI {
  static providerName = "openrouter";
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://openrouter.ai/api/v1/",
    model: "gpt-4o-mini",
    promptTemplates: {
      edit: osModelsEditPrompt,
    },
    useLegacyCompletionsEndpoint: false,
  };

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          "Authorization": this.apiKey ? `Bearer ${this.apiKey}` : "",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data: OpenRouterModelsResponse = await response.json();
      return data.data.map((model) => model.id);
    } catch (error) {
      console.error("Error fetching OpenRouter models:", error);
      // Return a fallback list of popular models if the API call fails
      return [
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "anthropic/claude-3.5-sonnet",
        "anthropic/claude-3-haiku",
        "meta-llama/llama-3.1-405b-instruct",
        "meta-llama/llama-3.1-70b-instruct",
        "meta-llama/llama-3.1-8b-instruct",
        "google/gemini-pro-1.5",
        "mistralai/mistral-large",
        "cohere/command-r-plus",
      ];
    }
  }

  /**
   * Exchange OAuth authorization code for API key
   * This method supports the OAuth PKCE flow for OpenRouter
   */
  static async exchangeCodeForApiKey(
    code: string,
    codeVerifier?: string,
    codeChallengeMethod?: string
  ): Promise<{ key: string; userId?: string }> {
    const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        code_challenge_method: codeChallengeMethod,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for API key: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Generate OAuth authorization URL for PKCE flow
   */
  static generateOAuthUrl(
    clientId: string,
    redirectUri: string,
    codeChallenge?: string,
    codeChallengeMethod: string = "S256"
  ): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
    });

    if (codeChallenge) {
      params.append("code_challenge", codeChallenge);
      params.append("code_challenge_method", codeChallengeMethod);
    }

    return `https://openrouter.ai/auth?${params.toString()}`;
  }
}

export default OpenRouter;
