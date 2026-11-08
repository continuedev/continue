import type { IDE } from "..";
import type { ProviderSetupConnection } from "./providerSetup";
import {
  envFileHasValue,
  readSecretFromEnvFile,
  removeSecretFromEnvFile,
  setSecretInEnvFile,
} from "../util/secretsFile";
import { isValidSecretName } from "../util/unresolvedSecrets";
import { withTimeout } from "../util/withTimeout";

/** Where the setup flow can keep an API key. */
export type SecretStorageKind = "secure" | "env";

const PROBE_KEY = "continuous.secretStorageProbe";

/**
 * How long to wait for the IDE's secret storage. A keychain can show an unlock
 * prompt, so this is generous; an IDE that never replies must not block
 * loading the config forever.
 */
export const SECURE_STORAGE_TIMEOUT_MS = 10_000;

/**
 * True when the IDE can store a secret and read it back. The CLI and the test
 * host return nothing from `readSecrets`, so they report false and the setup
 * flow falls back to ~/.continuous/.env. Nothing secret is written: the probe
 * stores a fixed marker under a fixed name.
 */
export async function isSecureStorageAvailable(
  ide: Pick<IDE, "readSecrets" | "writeSecrets">,
): Promise<boolean> {
  try {
    const marker = "ok";
    await withTimeout(
      ide.writeSecrets({ [PROBE_KEY]: marker }),
      SECURE_STORAGE_TIMEOUT_MS,
      "Secure storage",
    );
    const read = await withTimeout(
      ide.readSecrets([PROBE_KEY]),
      SECURE_STORAGE_TIMEOUT_MS,
      "Secure storage",
    );
    return read?.[PROBE_KEY] === marker;
  } catch {
    return false;
  }
}

export interface StoreSecretResult {
  stored: boolean;
  /** Where the value went: "secure" storage or the ".env" file. */
  location?: SecretStorageKind;
  /**
   * True when the value went to secure storage and ~/.continuous/.env still has a
   * plaintext copy of the same name. Secure storage is read first, so the copy
   * is unused; the UI offers to remove it (`removeEnvSecret`).
   */
  envShadowed?: boolean;
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
  /** ~/.continuous */
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
      // Secure storage is read before ~/.continuous/.env, so an old copy there
      // is unused. It is still plaintext, so the caller offers to remove it.
      const shadowed = envFileHasValue(continueDir, name);
      return {
        stored: true,
        location: "secure",
        ...(shadowed ? { envShadowed: true } : {}),
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

export interface RemoveEnvSecretResult {
  removed: boolean;
  /** Never contains the value. */
  error?: string;
}

/**
 * Delete the line for a secret from ~/.continuous/.env. Only call this after the
 * user agreed. It refuses unless the value is also in secure storage, so the
 * key is never lost.
 */
export async function removeEnvSecret(args: {
  ide: Pick<IDE, "readSecrets">;
  name: string;
  continueDir: string;
}): Promise<RemoveEnvSecretResult> {
  const { ide, name, continueDir } = args;
  if (!isValidSecretName(name)) {
    return { removed: false, error: `"${name}" is not a valid secret name` };
  }
  try {
    const stored = (await ide.readSecrets([name]))?.[name];
    if (!stored) {
      return {
        removed: false,
        error: "The key is not in secure storage, so the .env line was kept",
      };
    }
    return { removed: removeSecretFromEnvFile(continueDir, name) };
  } catch (e) {
    return {
      removed: false,
      error: e instanceof Error ? e.message : "Could not update the .env file",
    };
  }
}

export interface MoveKeyResult {
  /** The key is now in secure storage. */
  moved: boolean;
  /** The ~/.continuous/.env line is gone. False with `moved` true means it is still there. */
  envRemoved?: boolean;
  /** Never contains the value. */
  error?: string;
}

/**
 * Move a key from ~/.continuous/.env to secure storage. The value is read and
 * written here, in core; it is never returned. The .env line is removed only
 * after the value reads back from secure storage. config.yaml is not touched:
 * its `${{ secrets.NAME }}` reference stays valid.
 */
export async function moveEnvSecretToSecureStorage(args: {
  ide: Pick<IDE, "readSecrets" | "writeSecrets">;
  name: string;
  continueDir: string;
}): Promise<MoveKeyResult> {
  const { ide, name, continueDir } = args;
  if (!isValidSecretName(name)) {
    return { moved: false, error: `"${name}" is not a valid secret name` };
  }
  const value = readSecretFromEnvFile(continueDir, name);
  if (!value) {
    return {
      moved: false,
      error: `${name} has no value in ~/.continuous/.env`,
    };
  }
  const stored = await storeSecret({
    ide,
    name,
    value,
    storage: "secure",
    continueDir,
  });
  if (!stored.stored) return { moved: false, error: stored.error };
  try {
    return {
      moved: true,
      envRemoved: removeSecretFromEnvFile(continueDir, name),
    };
  } catch (e) {
    return {
      moved: true,
      envRemoved: false,
      error: e instanceof Error ? e.message : "Could not update the .env file",
    };
  }
}

/**
 * Fill in `key.storedIn` for connections whose key is a secret reference, so
 * the Providers card knows whether a key can be moved. Presence only.
 */
export async function annotateKeyStorage(
  connections: ProviderSetupConnection[],
  args: {
    ide: Pick<IDE, "readSecrets">;
    continueDir: string;
    secureStorageAvailable: boolean;
  },
): Promise<ProviderSetupConnection[]> {
  const names = [
    ...new Set(
      connections.flatMap((c) =>
        c.key.state === "secret" && c.key.secretName ? [c.key.secretName] : [],
      ),
    ),
  ];
  let inSecure: Record<string, string> = {};
  if (names.length > 0 && args.secureStorageAvailable) {
    try {
      inSecure = (await args.ide.readSecrets(names)) ?? {};
    } catch {
      inSecure = {};
    }
  }
  return connections.map((c) => {
    const name = c.key.secretName;
    if (c.key.state !== "secret" || !name) return c;
    return {
      ...c,
      key: {
        ...c.key,
        storedIn: {
          secure: !!inSecure[name],
          env: envFileHasValue(args.continueDir, name),
        },
      },
    };
  });
}
