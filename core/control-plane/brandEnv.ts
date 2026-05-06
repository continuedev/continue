/**
 * Configurable backend endpoints for the Yuto Agentic fork.
 *
 * The upstream project hardcodes `*.continue.dev` URLs and a WorkOS client ID
 * tied to infrastructure we do not own. This module reads those values from
 * environment variables instead, falling back to placeholders that disable
 * cloud features (hub, auth, telemetry, error reporting).
 *
 * See NAMING.md for the env var spec.
 */

const PLACEHOLDER_BASE = "https://placeholder.invalid";

export interface YutoBrandEnv {
  /** When true, all hub/auth/control-plane calls should no-op. */
  disabled: boolean;
  apiUrl: string;
  appUrl: string;
  hubUrl: string;
  workosClientId: string;
  posthogKey: string;
  sentryDsn: string;
}

let cached: YutoBrandEnv | undefined;

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined || v === "") {
    return undefined;
  }
  return v;
}

export function getBrandEnv(): YutoBrandEnv {
  if (cached) {
    return cached;
  }

  const apiUrl = readEnv("YUTOAGENTIC_API_URL");
  const appUrl = readEnv("YUTOAGENTIC_APP_URL");
  const hubUrl = readEnv("YUTOAGENTIC_HUB_URL");
  const workosClientId = readEnv("YUTOAGENTIC_WORKOS_CLIENT_ID");
  const posthogKey = readEnv("YUTOAGENTIC_POSTHOG_KEY");
  const sentryDsn = readEnv("YUTOAGENTIC_SENTRY_DSN");

  // The "disabled" flag is true when no backend endpoints are configured.
  // In that mode every call site should treat hub/auth/telemetry as no-ops.
  const disabled = !apiUrl || !workosClientId;

  cached = {
    disabled,
    apiUrl: apiUrl ?? `${PLACEHOLDER_BASE}/api/`,
    appUrl: appUrl ?? `${PLACEHOLDER_BASE}/app/`,
    hubUrl: hubUrl ?? `${PLACEHOLDER_BASE}/hub/`,
    workosClientId: workosClientId ?? "",
    posthogKey: posthogKey ?? "",
    sentryDsn: sentryDsn ?? "",
  };
  return cached;
}

/** Test helper: clear the in-process cache so env changes take effect. */
export function _resetBrandEnvCache(): void {
  cached = undefined;
}

export function isHubDisabled(): boolean {
  return getBrandEnv().disabled;
}
