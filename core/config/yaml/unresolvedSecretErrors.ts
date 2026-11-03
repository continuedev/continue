import type { ConfigValidationError } from "@continuedev/config-yaml";

import {
  findUnresolvedSecrets,
  type ModelWithCredentials,
} from "../../util/unresolvedSecrets";

/**
 * One non-fatal config error per secret that a model's credentials refer to
 * but that has no value on this machine. The error carries an `action` so the
 * GUI can offer to fix it; the message alone is enough for other clients.
 */
export function unresolvedSecretErrors(
  models: ModelWithCredentials[],
): ConfigValidationError[] {
  return findUnresolvedSecrets(models).map((secret) => {
    const used =
      secret.modelNames.length === 1
        ? `model "${secret.modelNames[0]}"`
        : `models ${secret.modelNames.map((n) => `"${n}"`).join(", ")}`;
    return {
      fatal: false,
      message: `The secret ${secret.secretName} is not set on this machine, so ${used} cannot authenticate. Add ${secret.secretName}=... to ~/.continue/.env or set it as an environment variable.`,
      action: {
        kind: "setSecret" as const,
        secretName: secret.secretName,
        providers: secret.providers,
        modelNames: secret.modelNames,
      },
    };
  });
}
