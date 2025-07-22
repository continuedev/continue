type NextEditModelName = "mercury-coder-nextedit" | "this field is not used";

export function isModelCapableOfNextEdit(modelName: string): boolean {
  const supportedModels: NextEditModelName[] = [
    "mercury-coder-nextedit",
    "this field is not used",
  ];
  return supportedModels.some((supported) => modelName.includes(supported));
}
