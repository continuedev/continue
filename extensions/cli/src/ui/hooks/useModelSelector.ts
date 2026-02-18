import { updateModelName } from "../../auth/workos.js";
import {
  SERVICE_NAMES,
  serviceContainer,
  services,
} from "../../services/index.js";
import { AuthServiceState, ModelServiceState } from "../../services/types.js";
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
  onRefreshUI?: () => void;
}

export function useModelSelector({
  onMessage,
  onModelSwitch,
  onRefreshUI,
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
      // and update the auth service state to reflect the change
      if (modelInfo?.name) {
        const updatedAuthConfig = updateModelName(modelInfo.name);

        // Update the AUTH service state in the container with the new config
        // This ensures that when MODEL service is reloaded, it gets the updated auth config
        const currentAuthState = services.auth.getState();
        serviceContainer.set<AuthServiceState>(SERVICE_NAMES.AUTH, {
          ...currentAuthState,
          authConfig: updatedAuthConfig,
        });
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

      // Force UI refresh to update the IntroMessage with new model
      if (onRefreshUI) {
        onRefreshUI();
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
