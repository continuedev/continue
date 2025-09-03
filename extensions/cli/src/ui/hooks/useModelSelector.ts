import { updateModelName } from "../../auth/workos.js";
import {
  SERVICE_NAMES,
  serviceContainer,
  services,
} from "../../services/index.js";
import { ModelServiceState } from "../../services/types.js";
import { useNavigation } from "../context/NavigationContext.js";

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
  const { closeCurrentScreen } = useNavigation();

  const handleModelSelect = async (model: ModelOption) => {
    closeCurrentScreen();

    try {
      await services.model.switchModel(model.index);
      const modelInfo = services.model.getModelInfo();

      // Update the service container to trigger re-renders
      const currentState = services.model.getState();
      serviceContainer.set<ModelServiceState>(
        SERVICE_NAMES.MODEL,
        currentState,
      );

      // Persist the model choice using the actual model name
      if (modelInfo?.name) {
        updateModelName(modelInfo.name);
      }

      onMessage({
        role: "system",
        content: `Switched to model: ${modelInfo?.name}`,
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

  return {
    handleModelSelect,
  };
}
