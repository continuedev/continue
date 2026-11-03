import type { IDE } from "..";
import { envFileHasValue, setSecretInEnvFile } from "../util/secretsFile";
import { isValidSecretName } from "../util/unresolvedSecrets";

/** Where the setup flow can keep an API key. */
export type SecretStorageKind = "secure" | "env";

const PROBE_KEY = "continued.secretStorageProbe";

/**
 * True when the IDE can store a secret and read it back. The CLI and the test
 * host return nothing from `readSecrets`, so they report false and the setup
 * flow falls back to ~/.continue/.env. Nothing secret is written: the probe
 * stores a fixed marker under a fixed name.
 */
export async function isSecureStorageAvailable(
  ide: Pick<IDE, "readSecrets" | "writeSecrets">,
): Promise<boolean> {
  try {
    const marker = "ok";
    await ide.writeSecrets({ [PROBE_KEY]: marker });
    const read = await ide.readSecrets([PROBE_KEY]);
    return read?.[PROBE_KEY] === marker;
  } catch {
    return false;
  }
}

export interface StoreSecretResult {
  stored: boolean;
  /** Where the value went: "secure" storage or the ".env" file. */
  location?: SecretStorageKind;
  /** Set when the value is stored but something else may still win a lookup. */
  warning?: string;
  /** Never contains the value. */
  error?: string;
}

/**
 * Store a secret value. Returns an error string instead of throwing, and
 * neither the value nor any part of it appears in the result or in a log.
 */
export async function storeSecret(args: {
  ide: Pick<IDE, "readSecrets" | "writeSecrets">;
  name: string;
  value: string;
  storage: SecretStorageKind;
  /** ~/.continue */
  continueDir: string;
}): Promise<StoreSecretResult> {
  const { ide, name, value, storage, continueDir } = args;

  if (!isValidSecretName(name)) {
    return { stored: false, error: `"${name}" is not a valid secret name` };
  }
  if (value === "") {
    return { stored: false, error: "The key is empty" };
  }

  try {
    if (storage === "secure") {
      await ide.writeSecrets({ [name]: value });
      const check = await ide.readSecrets([name]);
      if (check?.[name] !== value) {
        return {
          stored: false,
          error: "This editor did not keep the key in secure storage",
        };
      }
      // A value in ~/.continue/.env is looked up first and would win.
      const shadowed = envFileHasValue(continueDir, name);
      return {
        stored: true,
        location: "secure",
        ...(shadowed
          ? {
              warning: `${name} also has a value in ~/.continue/.env, which is used first. Remove that line to use the stored key.`,
            }
          : {}),
      };
    }

    setSecretInEnvFile(continueDir, name, value);
    return { stored: true, location: "env" };
  } catch (e) {
    // The messages thrown here never include the value.
    return {
      stored: false,
      error: e instanceof Error ? e.message : "Could not store the key",
    };
  }
}
