import { providers } from "../pages/AddNewModel/configs/providers";

export interface ErrorAnalysis {
  parsedError: string;
  statusCode?: number;
  message?: string;
  modelTitle: string;
  providerName: string;
  apiKeyUrl?: string;
}

function parseErrorMessage(fullErrMsg: string): string {
  if (
    !fullErrMsg ||
    typeof fullErrMsg !== "string" ||
    !fullErrMsg.includes("\n\n")
  ) {
    return fullErrMsg;
  }

  const msg = fullErrMsg.split("\n\n").slice(1).join("\n\n");
  try {
    const parsed = JSON.parse(msg);
    if (parsed.error !== undefined && parsed.error !== null) {
      return JSON.stringify(parsed.error);
    }
    if (parsed.message !== undefined && parsed.message !== null) {
      return JSON.stringify(parsed.message);
    }
    return msg;
  } catch (e) {
    return msg;
  }
}

export function analyzeError(
  error: unknown,
  selectedModel: any,
): ErrorAnalysis {
  const errorMessage = (error as any)?.message;
  const parsedError = parseErrorMessage(
    typeof errorMessage === "string" ? errorMessage : "",
  );

  // Collect model information to display useful error info
  let modelTitle = "Chat model";
  let providerName = "the model provider";
  let apiKeyUrl: string | undefined = undefined;

  if (selectedModel) {
    modelTitle = selectedModel.title;
    providerName = selectedModel.provider;

    // If there's a matching provider from add model form provider info
    // We can get more info
    const foundProvider = Object.values(providers).find(
      (p) => p?.provider === selectedModel.provider,
    );
    if (foundProvider) {
      providerName = foundProvider.title;
      if (foundProvider.apiKeyUrl) {
        apiKeyUrl = foundProvider.apiKeyUrl;
      }
    }
  }

  let message: undefined | string = undefined;
  let statusCode: undefined | number = undefined;

  // Attempt to get error message and status code from error
  if (
    error &&
    (error instanceof Error || typeof error === "object") &&
    "message" in error &&
    typeof error["message"] === "string"
  ) {
    message = error["message"];
    const parts = message?.split(" ") ?? [];

    // Handle single word case (like "404")
    if (parts.length === 1) {
      const trimmed = parts[0].trim();
      if (trimmed !== "") {
        const code = Number(trimmed);
        if (!Number.isNaN(code)) {
          statusCode = code;
        }
      }
    } else if (parts.length > 1) {
      const status = parts[0] === "HTTP" ? parts[1] : parts[0];
      if (status) {
        const code = Number(status);
        if (!Number.isNaN(code)) {
          statusCode = code;
        }
      }
    }
  }

  return {
    parsedError,
    statusCode,
    message,
    modelTitle,
    providerName,
    apiKeyUrl,
  };
}
