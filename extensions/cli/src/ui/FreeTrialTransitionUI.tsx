import * as fs from "fs";
import * as path from "path";

import { Box, Text, useInput } from "ink";
import open from "open";
import React, { useState } from "react";
import useSWR from "swr";

import { listUserOrganizations } from "../auth/workos.js";
import { env } from "../env.js";
import {
  getApiKeyValidationError,
  isValidAnthropicApiKey,
} from "../util/apiKeyValidation.js";
import { updateAnthropicModelInYaml } from "../util/yamlConfigUpdater.js";

import { useNavigation } from "./context/NavigationContext.js";

const CONFIG_PATH = path.join(env.continueHome, "config.yaml");

// Helper functions for input handling
interface ChoiceInputOptions {
  input: string;
  key: any;
  selectedOption: number;
  setSelectedOption: (option: number) => void;
  hasOrganizations: boolean;
  handleOptionSelect: () => void;
}

function handleChoiceInput(options: ChoiceInputOptions): void {
  const {
    input,
    key,
    selectedOption,
    setSelectedOption,
    hasOrganizations,
    handleOptionSelect,
  } = options;
  if (key.upArrow && selectedOption > 1) {
    setSelectedOption(selectedOption - 1);
  } else if (key.downArrow && selectedOption < (hasOrganizations ? 4 : 3)) {
    setSelectedOption(selectedOption + 1);
  } else if (input === "1") {
    setSelectedOption(1);
  } else if (input === "2") {
    setSelectedOption(2);
  } else if (input === "3") {
    setSelectedOption(3);
  } else if (input === "4" && hasOrganizations) {
    setSelectedOption(4);
  } else if (key.return) {
    handleOptionSelect();
  }
}

interface ApiKeyInputOptions {
  input: string;
  key: any;
  apiKey: string;
  setApiKey: (key: string) => void;
  setErrorMessage: (msg: string) => void;
  handleApiKeySubmit: () => void;
}

function handleApiKeyInput(options: ApiKeyInputOptions): void {
  const { input, key, apiKey, setApiKey, setErrorMessage, handleApiKeySubmit } =
    options;
  if (key.return) {
    if (isValidAnthropicApiKey(apiKey)) {
      handleApiKeySubmit();
    } else {
      setErrorMessage(getApiKeyValidationError(apiKey));
    }
  } else if (key.backspace || key.delete) {
    setApiKey(apiKey.slice(0, -1));
    setErrorMessage("");
  } else if (input && !key.ctrl && !key.meta) {
    setApiKey(apiKey + input);
    setErrorMessage("");
  }
}

interface FreeTrialTransitionUIProps {
  onReload: () => void;
}

/**
 * Creates or updates the local config with Anthropic API key
 */
async function createOrUpdateConfig(apiKey: string): Promise<void> {
  const configDir = path.dirname(CONFIG_PATH);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const existingContent = fs.existsSync(CONFIG_PATH)
    ? fs.readFileSync(CONFIG_PATH, "utf8")
    : "";

  const updatedContent = updateAnthropicModelInYaml(existingContent, apiKey);
  fs.writeFileSync(CONFIG_PATH, updatedContent);
}

const FreeTrialTransitionUI: React.FC<FreeTrialTransitionUIProps> = ({
  onReload,
}) => {
  const { navigateTo, closeCurrentScreen } = useNavigation();
  const [currentStep, setCurrentStep] = useState<
    "choice" | "enterApiKey" | "processing" | "success" | "error"
  >("choice");
  const [selectedOption, setSelectedOption] = useState(1);
  const [apiKey, setApiKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [wasModelsSetup, setWasModelsSetup] = useState(false);

  // Fetch organizations using SWR
  const { data: organizations } = useSWR(
    "organizations",
    listUserOrganizations,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  );

  const hasOrganizations = organizations && organizations.length > 0;

  useInput((input, key) => {
    if (currentStep === "choice") {
      handleChoiceInput({
        input,
        key,
        selectedOption,
        setSelectedOption,
        hasOrganizations: !!hasOrganizations,
        handleOptionSelect,
      });
    } else if (currentStep === "enterApiKey") {
      handleApiKeyInput({
        input,
        key,
        apiKey,
        setApiKey,
        setErrorMessage,
        handleApiKeySubmit,
      });
    } else if (currentStep === "success" || currentStep === "error") {
      if (key.return) {
        closeCurrentScreen();
        // If user went through models setup, do a full reload to register their purchase
        if (wasModelsSetup) {
          onReload();
        }
      }
    }
  });

  const handleOptionSelect = async () => {
    if (selectedOption === 1) {
      // Option 1: Open models setup page
      setCurrentStep("processing");
      const modelsUrl = new URL("setup-models", env.appUrl).toString();
      setWasModelsSetup(true); // Track that user went through models setup

      try {
        await open(modelsUrl);
        setSuccessMessage(
          `Browser opened to ${modelsUrl}. After setting up your models subscription, press Enter to continue.`,
        );
        setCurrentStep("success");
      } catch {
        setErrorMessage(
          `Could not open browser automatically. Please visit: ${modelsUrl}. After setting up your models subscription, press Enter to continue.`,
        );
        setCurrentStep("error");
      }
    } else if (selectedOption === 2) {
      // Option 2: Enter API key
      setCurrentStep("enterApiKey");
      setWasModelsSetup(false); // This is not models setup
    } else if (selectedOption === 3) {
      // Option 3: Switch to different configuration
      navigateTo("config");
    } else if (selectedOption === 4 && hasOrganizations) {
      // Option 4: Switch to configuration (includes organization switching)
      navigateTo("config");
    }
  };

  const handleApiKeySubmit = async () => {
    setCurrentStep("processing");

    try {
      await createOrUpdateConfig(apiKey);
      setSuccessMessage(
        "✓ API key saved successfully! Switching to local configuration...",
      );
      setCurrentStep("success");

      // After a brief delay, switch to local configuration
      setTimeout(() => {
        closeCurrentScreen();
        onReload();
      }, 1000);
    } catch (error) {
      setErrorMessage(
        `❌ Error saving API key: ${error}. Press Enter to try again.`,
      );
      setCurrentStep("error");
    }
  };

  if (currentStep === "choice") {
    return (
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="yellow"
      >
        <Text bold color="yellow">
          🚀 Free trial limit reached!
        </Text>
        <Text>Choose how you'd like to continue:</Text>
        <Text></Text>
        <Text color={selectedOption === 1 ? "cyan" : "white"}>
          {selectedOption === 1 ? "▶ " : "  "}1. 💳 Sign up for models add-on
          (recommended)
        </Text>
        <Text color={selectedOption === 2 ? "cyan" : "white"}>
          {selectedOption === 2 ? "▶ " : "  "}2. 🔑 Enter your Anthropic API
          key
        </Text>
        <Text color={selectedOption === 3 ? "cyan" : "white"}>
          {selectedOption === 3 ? "▶ " : "  "}3. ⚙️ Switch to a different
          configuration
        </Text>
        {hasOrganizations && (
          <Text color={selectedOption === 4 ? "cyan" : "white"}>
            {selectedOption === 4 ? "▶ " : "  "}4. 🏢 Switch to organization
            configuration
          </Text>
        )}
        <Text></Text>
        <Text color="gray">
          Use ↑↓ arrows or {hasOrganizations ? "1/2/3/4" : "1/2/3"} to select,
          Enter to confirm
        </Text>
      </Box>
    );
  }

  if (currentStep === "enterApiKey") {
    return (
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="yellow"
      >
        <Text bold color="yellow">
          Enter your Anthropic API key
        </Text>
        <Text></Text>
        <Text>API Key: {"*".repeat(apiKey.length)}</Text>
        <Text></Text>
        {errorMessage && <Text color="red">{errorMessage}</Text>}
        <Text color="gray">
          Type your API key and press Enter (must start with 'sk-ant-')
        </Text>
      </Box>
    );
  }

  if (currentStep === "processing") {
    return (
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="blue"
      >
        <Text bold color="blue">
          Processing...
        </Text>
        <Text>Please wait...</Text>
      </Box>
    );
  }

  if (currentStep === "success") {
    return (
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="green"
      >
        <Text bold color="green">
          Success!
        </Text>
        <Text>{successMessage}</Text>
        <Text></Text>
        <Text color="gray">
          {wasModelsSetup
            ? "Press Enter to reload and continue with your new subscription"
            : "Press Enter to continue your conversation"}
        </Text>
      </Box>
    );
  }

  if (currentStep === "error") {
    return (
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="red"
      >
        <Text bold color="red">
          Error
        </Text>
        <Text>{errorMessage}</Text>
        <Text></Text>
        <Text color="gray">
          {wasModelsSetup
            ? "Press Enter to reload and try again"
            : "Press Enter to continue"}
        </Text>
      </Box>
    );
  }

  return null;
};

export { FreeTrialTransitionUI };
