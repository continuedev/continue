import { isAuthenticatedConfig } from "../../auth/workos.js";
import { services, reloadService } from "../../services/index.js";
import { SERVICE_NAMES } from "../../services/types.js";
import { useNavigation } from "../context/NavigationContext.js";

interface UseOrganizationSelectorProps {
  onMessage: (message: {
    role: string;
    content: string;
    messageType: "system";
  }) => void;
  onChatReset: () => void;
}

export function useOrganizationSelector({
  onMessage,
  onChatReset,
}: UseOrganizationSelectorProps) {
  const { closeCurrentScreen } = useNavigation();

  const handleOrganizationSelect = async (
    organizationId: string | null,
    organizationName: string,
  ) => {
    try {
      // Check if user is authenticated
      const authState = services.auth.getState();
      if (!authState.isAuthenticated || !authState.authConfig) {
        onMessage({
          role: "system",
          content: "Organization switching not available - not authenticated",
          messageType: "system" as const,
        });
        return;
      }

      if (!isAuthenticatedConfig(authState.authConfig)) {
        onMessage({
          role: "system",
          content:
            "Organization switching not available for environment variable auth",
          messageType: "system" as const,
        });
        return;
      }

      // Show loading message
      onMessage({
        role: "system",
        content: `Switching to organization: ${organizationName}...`,
        messageType: "system" as const,
      });

      // Switch organization through the auth service
      await services.auth.switchOrganization(organizationId);

      // Reload all dependent services (API_CLIENT -> CONFIG -> MODEL/MCP)
      await reloadService(SERVICE_NAMES.AUTH);

      // Reset chat history
      onChatReset();

      // Clear the screen completely
      process.stdout.write("\x1b[2J\x1b[H");

      // Show success message
      onMessage({
        role: "system",
        content: `Successfully switched to organization: ${organizationName}`,
        messageType: "system" as const,
      });

      // Close the organization selector
      closeCurrentScreen();
    } catch (error: any) {
      // Show error message
      onMessage({
        role: "system",
        content: `Failed to switch organization: ${error.message}`,
        messageType: "system" as const,
      });

      // Close selector even on error
      closeCurrentScreen();
    }
  };

  return {
    handleOrganizationSelect,
  };
}
