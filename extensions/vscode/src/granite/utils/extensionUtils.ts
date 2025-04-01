import { isTestMode, SHOW_GRANITE_ONBOARDING_CARD_KEY } from "core/granite/commons/constants";
import { ExtensionContext } from "vscode";

/**
 * Returns true if the Granite onboarding has been completed. Always returns true in test mode.
 *
 * @param context The extension context
 * @returns True if the Granite onboarding has been completed. Always returns true in test mode.
 */
export function isGraniteOnboardingComplete(context: ExtensionContext): boolean {
    const showOnboarding = context.globalState.get<boolean>(SHOW_GRANITE_ONBOARDING_CARD_KEY, true);
    return (!showOnboarding || isTestMode === true);
}
