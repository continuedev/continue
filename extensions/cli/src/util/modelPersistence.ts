import { GlobalContext } from "core/util/GlobalContext.js";

/**
 * Get the persisted model name for CLI from GlobalContext
 * Used for unauthenticated users
 */
export function getPersistedModelName(): string | null {
  const globalContext = new GlobalContext();
  return globalContext.get("cliSelectedModel") ?? null;
}

/**
 * Persist the model name for CLI to GlobalContext
 * Used for unauthenticated users
 */
export function persistModelName(modelName: string | null): void {
  const globalContext = new GlobalContext();
  globalContext.update("cliSelectedModel", modelName ?? undefined);
}
