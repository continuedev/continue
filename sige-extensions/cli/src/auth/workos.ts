/**
 * Auth configuration stubs.
 *
 * Hub/WorkOS authentication has been removed. These exports are kept as
 * no-op stubs so that the rest of the codebase compiles without changing
 * every import site.
 */

import {
  getPersistedModelName,
  persistModelName,
} from "../util/modelPersistence.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * AuthConfig is always null now that Hub auth has been removed.
 */
export type AuthConfig = null;

/**
 * Kept for type compatibility - code that references AuthenticatedConfig will
 * still compile but the type is never instantiated at runtime.
 */
export interface AuthenticatedConfig {
  userId: string;
  userEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  organizationId: string | null | undefined;
  configUri?: string;
  modelName?: string;
}

export interface EnvironmentAuthConfig {
  userId?: undefined;
  accessToken: string;
  organizationId: string | null;
  configUri?: string;
  modelName?: string;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isAuthenticatedConfig(_config: AuthConfig): _config is never {
  return false;
}

export function isEnvironmentAuthConfig(_config: AuthConfig): _config is never {
  return false;
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export function getAccessToken(_config: AuthConfig): null {
  return null;
}

export function getOrganizationId(_config: AuthConfig): null {
  return null;
}

export function getConfigUri(_config: AuthConfig): null {
  return null;
}

export function getModelName(_config: AuthConfig): string | null {
  return getPersistedModelName();
}

// ---------------------------------------------------------------------------
// Config loading / saving (no-ops)
// ---------------------------------------------------------------------------

export function loadAuthConfig(): AuthConfig {
  return null;
}

export function saveAuthConfig(_config: AuthenticatedConfig): void {
  // no-op
}

export function updateConfigUri(_configUri: string | null): void {
  // no-op
}

export function updateModelName(modelName: string | null): AuthConfig {
  persistModelName(modelName);
  return null;
}

// ---------------------------------------------------------------------------
// Legacy convenience helpers
// ---------------------------------------------------------------------------

export function getAssistantSlug(_config: AuthConfig): null {
  return null;
}

export function getLocalConfigPath(_config: AuthConfig): null {
  return null;
}

export function updateAssistantSlug(_assistantSlug: string | null): void {
  // no-op
}

export function updateLocalConfigPath(_localConfigPath: string | null): void {
  // no-op
}

// ---------------------------------------------------------------------------
// Auth operations (stubs)
// ---------------------------------------------------------------------------

export async function isAuthenticated(): Promise<boolean> {
  return false;
}

export async function login(): Promise<AuthConfig> {
  throw new Error(
    "Login is not available. Hub authentication has been removed.",
  );
}

export function logout(): void {
  // no-op
}

export async function ensureOrganization(
  authConfig: AuthConfig,
  _isHeadless?: boolean,
  _cliOrganizationSlug?: string,
): Promise<AuthConfig> {
  return authConfig;
}

export async function listUserOrganizations(): Promise<null> {
  return null;
}

export async function hasMultipleOrganizations(): Promise<boolean> {
  return false;
}
