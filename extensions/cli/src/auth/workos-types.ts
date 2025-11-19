/**
 * Device authorization response from WorkOS
 */
export interface DeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

// Represents an authenticated user's configuration
export interface AuthenticatedConfig {
  userId: string;
  userEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  organizationId: string | null | undefined; // null means personal organization, undefined triggers auto-selection
  configUri?: string; // Optional config URI (file:// or slug://owner/slug)
  modelName?: string; // Name of the selected model
}

// Represents configuration when using environment variable auth
export interface EnvironmentAuthConfig {
  /**
   * This userId?: undefined; field a trick to help TypeScript differentiate between
   * AuthenticatedConfig and EnvironmentAuthConfig. Otherwise AuthenticatedConfig is
   * a possible subtype of EnvironmentAuthConfig and TypeScript gets confused where
   * type guards are involved.
   */
  userId?: undefined;
  accessToken: string;
  organizationId: string | null; // Can be set via --org flag in headless mode
  configUri?: string; // Optional config URI (file:// or slug://owner/slug)
  modelName?: string; // Name of the selected model
}
