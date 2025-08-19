import { ConfigHandler } from "../../config/ConfigHandler";
import { usesFreeTrialApiKey } from "../../config/usesFreeTrialApiKey";

export interface HubToolsAccess {
  hasAccess: boolean;
  isSignedIn: boolean;
  reason?: string;
}

export async function checkHubToolsAccess(
  configHandler: ConfigHandler,
): Promise<HubToolsAccess> {
  const isSignedIn = await configHandler.controlPlaneClient.isSignedIn();

  if (!isSignedIn) {
    return {
      hasAccess: false,
      isSignedIn: false,
      reason:
        "Sign in to Continue Hub required to access web search and other premium tools.",
    };
  }

  const { config } = await configHandler.getSerializedConfig();
  const isFreeTrial = config ? usesFreeTrialApiKey(config) : false;

  if (isFreeTrial) {
    return {
      hasAccess: false,
      isSignedIn: true,
      reason:
        "Upgrade to a paid Continue Hub account to access web search and other premium tools.",
    };
  }

  return {
    hasAccess: true,
    isSignedIn: true,
  };
}
