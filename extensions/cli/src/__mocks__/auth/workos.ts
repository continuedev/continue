import { vi } from "vitest";

export const isAuthenticated = vi.fn(() => Promise.resolve(false));
export const isAuthenticatedConfig = vi.fn(() => false);
export const isEnvironmentAuthConfig = vi.fn(() => false);
export const loadAuthConfig = vi.fn(() => null);
export const login = vi.fn();
export const logout = vi.fn();
export const ensureOrganization = vi.fn();
export const getOrganizationId = vi.fn(() => null);
export const saveAuthConfig = vi.fn();
export const listUserOrganizations = vi.fn();
export const hasMultipleOrganizations = vi.fn();
<<<<<<< HEAD
export const initWorkOS = vi.fn();
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
export const getModelName = vi.fn(() => null);
export const getAccessToken = vi.fn(() => null);
export const getConfigUri = vi.fn(() => null);
export const getAssistantSlug = vi.fn(() => null);
export const getLocalConfigPath = vi.fn(() => null);
export const updateConfigUri = vi.fn();
export const updateModelName = vi.fn();
export const updateAssistantSlug = vi.fn();
export const updateLocalConfigPath = vi.fn();
<<<<<<< HEAD
=======

// Type re-exports for test compatibility
export type AuthConfig = null;
export type {
  AuthenticatedConfig,
  EnvironmentAuthConfig,
} from "../../auth/workos.js";
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
