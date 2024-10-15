import { window, ExtensionContext, workspace, ConfigurationTarget } from "vscode";

const SHOULD_SHOW_CONSENT = "shouldShowConsentNotification";

async function shouldShowConsent(context: ExtensionContext): Promise<boolean> {
  // If it is the first time the property is undefined, it will return true
  return context.globalState.get(SHOULD_SHOW_CONSENT) ?? true;
}

export async function showConsentNotification(context: ExtensionContext): Promise<void> {
  if (!(await shouldShowConsent(context))) {
    return; // Early exit if consent has already been handled
  }
  const consentMessage = `You are using the SAP AI Code assistant tool.\nPlease note that this feature will reduce your AI quota as it generates the code. The generated code was created using AI and therefore must be reviewed.`;
  const selection = await window.showInformationMessage(consentMessage, "OK", "Disable Tool");
  try {
    // in any selection, we will update the global state to not show the consent notification again.
    await context.globalState.update(SHOULD_SHOW_CONSENT, false);
    if (selection === "Disable Tool") {
      workspace
        .getConfiguration("AI Code Assistant")
        .update("tabToEnableAutocomplete", false, ConfigurationTarget.Global);
    }
  } catch (error) {
    console.error("Error updating consent settings:", error);
  }
}
