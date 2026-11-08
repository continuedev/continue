/**
 * Detection of `${{ secrets.NAME }}` references that were not replaced with a
 * value when the config was loaded.
 *
 * Local config loading (LocalPlatformClient) looks a secret up in
 * ~/.continuous/.env, the workspace .env files and the process environment. A
 * name that is found nowhere is left in the text as is, and that literal text
 * then ends up being used as the API key. These helpers find such leftovers so
 * the config can report them instead.
 */

const SECRET_REF_REGEX = /\$\{\{\s*secrets\.([^}\s]+)\s*\}\}/g;

/** Model fields that hold credentials, and so may reference a secret. */
export const CREDENTIAL_ENV_KEYS = [
  "accessKeyId",
  "secretAccessKey",
  "sessionToken",
] as const;

/**
 * Names of the secrets referenced in a string. A reference to a packaged
 * secret looks like `owner/package/NAME`; only the final `NAME` is returned,
 * since that is what a user sets in .env.
 */
export function findSecretNames(value: unknown): string[] {
  if (typeof value !== "string" || !value.includes("secrets.")) {
    return [];
  }
  const names: string[] = [];
  for (const match of value.matchAll(SECRET_REF_REGEX)) {
    const name = match[1].split("/").pop();
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

export interface ModelWithCredentials {
  name: string;
  provider: string;
  apiKey?: string;
  env?: Record<string, unknown>;
  requestOptions?: { headers?: Record<string, string> };
}

export interface UnresolvedSecret {
  secretName: string;
  /** Models whose credentials reference this secret. */
  modelNames: string[];
  /** Providers of those models (for a readable message). */
  providers: string[];
}

/**
 * Secrets referenced by model credentials that are still unresolved, grouped
 * by secret name. Only credential fields are scanned, so a rule or prompt that
 * mentions `${{ secrets.X }}` in prose is never reported.
 */
export function findUnresolvedSecrets(
  models: ModelWithCredentials[],
): UnresolvedSecret[] {
  const bySecret = new Map<string, UnresolvedSecret>();

  const add = (secretName: string, model: ModelWithCredentials) => {
    const entry = bySecret.get(secretName) ?? {
      secretName,
      modelNames: [],
      providers: [],
    };
    if (!entry.modelNames.includes(model.name)) {
      entry.modelNames.push(model.name);
    }
    if (!entry.providers.includes(model.provider)) {
      entry.providers.push(model.provider);
    }
    bySecret.set(secretName, entry);
  };

  for (const model of models) {
    const values: unknown[] = [model.apiKey];
    for (const key of CREDENTIAL_ENV_KEYS) {
      values.push(model.env?.[key]);
    }
    for (const header of Object.values(model.requestOptions?.headers ?? {})) {
      values.push(header);
    }
    for (const value of values) {
      for (const name of findSecretNames(value)) {
        add(name, model);
      }
    }
  }

  return [...bySecret.values()];
}

/** A secret name is safe to write into a .env file as `NAME=`. */
export function isValidSecretName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

/** The credential-bearing fields of a loaded model (see BaseLLM). */
export interface LlmCredentialFields {
  apiKey?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  requestOptions?: { headers?: Record<string, string> };
}

/**
 * Secrets that a loaded model still refers to but that had no value when the
 * config was rendered. Used both to report the model as misconfigured and to
 * refuse to send a request with the literal reference as its credential.
 */
export function unresolvedSecretNamesOfLlm(llm: LlmCredentialFields): string[] {
  const values: unknown[] = [
    llm.apiKey,
    llm.accessKeyId,
    llm.secretAccessKey,
    llm.sessionToken,
    ...Object.values(llm.requestOptions?.headers ?? {}),
  ];
  const names: string[] = [];
  for (const value of values) {
    for (const name of findSecretNames(value)) {
      if (!names.includes(name)) {
        names.push(name);
      }
    }
  }
  return names;
}

const MISSING_SECRET_MARKER = "is not set on this machine (missing secret";

/** Error thrown instead of sending a request whose credential is a bare reference. */
export class MissingSecretError extends Error {
  constructor(
    public readonly modelTitle: string,
    public readonly secretNames: string[],
  ) {
    super(
      `The API key for "${modelTitle}" ${MISSING_SECRET_MARKER}${
        secretNames.length === 1 ? "" : "s"
      }: ${secretNames.join(", ")}). Set it in ~/.continuous/.env or as an environment variable.`,
    );
    this.name = "MissingSecretError";
  }
}

/**
 * Secret names mentioned by a MissingSecretError message. Works on the text
 * alone because errors cross the core/GUI boundary as strings.
 */
export function parseMissingSecretNames(message: string | undefined): string[] {
  if (!message) {
    return [];
  }
  const start = message.indexOf(MISSING_SECRET_MARKER);
  if (start === -1) {
    return [];
  }
  const rest = message.slice(start + MISSING_SECRET_MARKER.length);
  const match = rest.match(/^s?: ([A-Za-z0-9_, ]+)\)/);
  if (!match) {
    return [];
  }
  return match[1]
    .split(",")
    .map((n) => n.trim())
    .filter(isValidSecretName);
}
