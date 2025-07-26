type NextEditModelName = "mercury-coder-nextedit";

export function isModelCapableOfNextEdit(modelName: string): boolean {
  // In test mode, we can control whether next edit is enabled via environment variable.
  if (process.env.NEXT_EDIT_TEST_ENABLED === "false") {
    return false;
  }

  if (process.env.NEXT_EDIT_TEST_ENABLED === "true") {
    return true;
  }

  const supportedModels: NextEditModelName[] = ["mercury-coder-nextedit"];
  return supportedModels.some((supported) => modelName.includes(supported));
}
