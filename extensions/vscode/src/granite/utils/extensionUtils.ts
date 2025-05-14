import { GRANITE_ONBOARDING_INCOMPLETE_KEY, isTestMode } from "core/granite/commons/constants";
import { ExtensionContext } from "vscode";

/**
 * Returns true if the Granite onboarding has been completed. Always returns true in test mode.
 *
 * @param context The extension context
 * @returns True if the Granite onboarding has been completed. Always returns true in test mode.
 */
export function isGraniteOnboardingComplete(context: ExtensionContext): boolean {
    const isOnboardingIncomplete = context.globalState.get<boolean>(GRANITE_ONBOARDING_INCOMPLETE_KEY, true);
    return (!isOnboardingIncomplete || isTestMode === true);
}
