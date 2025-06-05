export const isDevMode = process.env.CONTINUE_DEVELOPMENT === "true";
export const isTestMode = process.env.CONTINUE_GLOBAL_DIR?.includes("e2e/test");

//Despite its name, this key is now used to track whether the user has completed the onboarding flow
// showGraniteOnboardingCard===true means the user has completed the onboarding flow
export const GRANITE_ONBOARDING_INCOMPLETE_KEY = "showGraniteOnboardingCard";

// This key is used to track whether the user has run the initial activation flow
export const GRANITE_INITIAL_ACTIVATION_COMPLETED_KEY =
  "graniteInitialActivationCompleted";
