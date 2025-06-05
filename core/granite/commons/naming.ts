export function getStandardName(modelName: string): string {
  return modelName.includes(":") ? modelName : `${modelName}:latest`;
}
