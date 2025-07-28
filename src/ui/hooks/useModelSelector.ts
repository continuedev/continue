import { useState } from "react";
import { services, serviceContainer, SERVICE_NAMES } from "../../services/index.js";
import { ModelServiceState } from "../../services/types.js";

interface ModelOption {
  id: string;
  name: string;
  index: number;
  provider: string;
}

interface UseModelSelectorProps {
  onMessage: (message: {
    role: string;
    content: string;
    messageType: "system";
  }) => void;
  onModelSwitch?: () => void;
}

export function useModelSelector({
  onMessage,
  onModelSwitch,
}: UseModelSelectorProps) {
  const [showModelSelector, setShowModelSelector] = useState(false);

  const handleModelSelect = async (model: ModelOption) => {
    setShowModelSelector(false);

    try {
      await services.model.switchModel(model.index);
      const modelInfo = services.model.getModelInfo();
      
      // Update the service container to trigger re-renders
      const currentState = services.model.getState();
      serviceContainer.set<ModelServiceState>(SERVICE_NAMES.MODEL, currentState);
      
      onMessage({
        role: "system",
        content: `Switched to model: ${modelInfo?.provider}/${modelInfo?.name}`,
        messageType: "system",
      });

      // Trigger any additional actions after model switch
      if (onModelSwitch) {
        onModelSwitch();
      }
    } catch (error: any) {
      onMessage({
        role: "system",
        content: `Failed to switch model: ${error.message}`,
        messageType: "system",
      });
    }
  };

  const handleModelCancel = () => {
    setShowModelSelector(false);
  };

  const showModelSelectorUI = () => {
    setShowModelSelector(true);
  };

  return {
    showModelSelector,
    handleModelSelect,
    handleModelCancel,
    showModelSelectorUI,
  };
}