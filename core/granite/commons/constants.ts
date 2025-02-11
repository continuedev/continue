export const isDevMode = process.env.CONTINUE_DEVELOPMENT === "true";
export const isTestMode = process.env.CONTINUE_GLOBAL_DIR?.includes("e2e/test");