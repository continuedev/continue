/**
 * Shapes shared by core and the webview for provider instances
 * (providers.yaml) and plaintext key migration. Kept free of Node imports.
 */

export type ProviderKeyState = {
  state: "none" | "inline" | "secret";
  /** For "secret": the name in `${{ secrets.NAME }}`. */
  secretName?: string;
  /** For "secret": where a value exists. Presence only, never values. */
  storedIn?: { secure: boolean; env: boolean };
};

export interface ProviderInstanceInfo {
  name: string;
  provider: string;
  apiBase?: string;
  env?: Record<string, string | number | boolean>;
  /** Header names only; values can be credentials. */
  headerNames?: string[];
  /** "global" is ~/.continuous/providers.yaml; only it is edited from the GUI. */
  source: "global" | "workspace";
  sourceUri: string;
  /** Overridden by a workspace instance of the same name. */
  overridden?: boolean;
  key: ProviderKeyState;
  /** Models in local configs that use this instance with `connection:`. */
  usedBy: { config: string; model: string }[];
}

export interface ProviderInstancesInfo {
  instances: ProviderInstanceInfo[];
  globalFileUri: string;
  secureStorageAvailable: boolean;
}

export type ProviderInstanceKeyUpdate =
  /** Store `value` (when given) under `secretName` and reference it. */
  | { storage: "secure" | "env"; secretName?: string; value?: string }
  /** The provider needs no key (e.g. a local server). */
  | { storage: "none" };

export interface SaveProviderInstanceRequest {
  /** The instance's current name, when editing; omit to add one. */
  previousName?: string;
  name: string;
  provider: string;
  apiBase?: string;
  env?: Record<string, string | number | boolean>;
  /** Omit to keep the instance's key as it is. */
  key?: ProviderInstanceKeyUpdate;
}

export type SaveProviderInstanceResult =
  | {
      saved: true;
      /** Models whose `connection:` was renamed with the instance. */
      modelsUpdated?: number;
      envShadowedSecret?: string;
    }
  | { saved: false; error: string };

/** An API key written as plain text in a config or providers file. */
export interface PlaintextKey {
  /** `<file uri>#<models|providers>.<index>` */
  id: string;
  fileUri: string;
  fileLabel: string;
  kind: "model" | "provider";
  /** The model's or provider instance's name. */
  label: string;
  /** The secret name the key would be stored under. */
  secretName: string;
}

export interface MovePlaintextKeysResult {
  moved: string[];
  failed: { id: string; error: string }[];
}

/** Values that are placeholders in examples, not keys. */
export function looksLikePlaceholderKey(value: string): boolean {
  const v = value.trim();
  return (
    v === "" ||
    v.includes("${{") ||
    /^(your|enter|insert|add|replace|put)[-_ ]/i.test(v) ||
    /[-_ ](here|key)$/i.test(v) ||
    /^<.*>$/.test(v) ||
    /^(sk-)?\.{3,}$|^x{4,}$|^\*+$/i.test(v) ||
    /^(none|null|dummy|placeholder|changeme|todo|ollama|lm-studio)$/i.test(v)
  );
}
