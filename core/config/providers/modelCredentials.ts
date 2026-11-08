import type { IDE, JSONModelDescription } from "../../index.js";
import {
  defaultSecretName,
  secretReference,
  type SaveProviderModelsRequest,
} from "../providerSetup";
import {
  storeSecret,
  type SecretStorageKind,
  type StoreSecretResult,
} from "../secretStorage";
import { accountNameFor } from "./accountSetup";

/** Secret values a model can carry besides its API key (Bedrock access keys). */
const CREDENTIAL_FIELDS = [
  ["accessKeyId", "access-key-id"],
  ["secretAccessKey", "secret-access-key"],
  ["sessionToken", "session-token"],
] as const;

function hasCredential(model: JSONModelDescription, field: string): boolean {
  const value = (model as unknown as Record<string, unknown>)[field];
  return typeof value === "string" && value !== "" && !value.includes("${{");
}

/** True when saving this request would write a credential into a YAML file. */
export function requestHasCredentials(req: SaveProviderModelsRequest): boolean {
  return (req.add ?? []).some((model) =>
    CREDENTIAL_FIELDS.some(([field]) => hasCredential(model, field)),
  );
}

/**
 * Store each credential on the models being added, and return the request with
 * `${{ secrets.NAME }}` in their place, so the value goes no further than the
 * secret store. Names come from the account, so two accounts keep their own.
 * On failure nothing should be saved: `error` is set and never holds a value.
 */
export async function moveCredentialsToSecrets(args: {
  req: SaveProviderModelsRequest;
  ide: Pick<IDE, "readSecrets" | "writeSecrets">;
  storage: SecretStorageKind;
  continueDir: string;
}): Promise<{
  req: SaveProviderModelsRequest;
  error?: string;
  envShadowedSecret?: string;
}> {
  const { req, ide, storage, continueDir } = args;
  const account = accountNameFor(
    req.provider,
    req.connection,
    req.account?.name,
  );
  const stored = new Map<string, Promise<StoreSecretResult>>();
  let envShadowedSecret: string | undefined;

  const add: JSONModelDescription[] = [];
  for (const model of req.add ?? []) {
    const next = { ...model } as unknown as Record<string, string>;
    for (const [field, suffix] of CREDENTIAL_FIELDS) {
      if (!hasCredential(model, field)) continue;
      const name = defaultSecretName(`${account}-${suffix}`);
      // Every model of a setup carries the same credentials: store them once.
      if (!stored.has(name)) {
        stored.set(
          name,
          storeSecret({ ide, name, value: next[field], storage, continueDir }),
        );
      }
      const result = await stored.get(name)!;
      if (!result.stored) {
        return { req, error: result.error ?? "Could not store the credential" };
      }
      if (result.envShadowed) envShadowedSecret = name;
      next[field] = secretReference(name);
    }
    add.push(next as unknown as JSONModelDescription);
  }
  return {
    req: { ...req, add },
    ...(envShadowedSecret ? { envShadowedSecret } : {}),
  };
}
