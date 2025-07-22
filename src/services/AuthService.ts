import {
  AuthenticatedConfig,
  login as doLogin,
  logout as doLogout,
  ensureOrganization,
  isAuthenticated,
  listUserOrganizations,
  loadAuthConfig,
  saveAuthConfig,
} from "../auth/workos.js";
import logger from "../util/logger.js";
import { AuthServiceState } from "./types.js";

/**
 * Service for managing authentication state and operations
 * Encapsulates all auth logic and provides reactive updates
 */
export class AuthService {
  private currentState: AuthServiceState = {
    authConfig: null,
    isAuthenticated: false,
  };

  /**
   * Initialize the auth service by loading current config
   */
  async initialize(): Promise<AuthServiceState> {
    logger.debug("Initializing AuthService");

    const authConfig = loadAuthConfig();
    const authenticated = isAuthenticated();

    this.currentState = {
      authConfig,
      isAuthenticated: authenticated,
      organizationId: authConfig?.organizationId || undefined,
    };

    logger.debug("AuthService initialized", {
      authenticated,
      hasConfig: !!authConfig,
      orgId: this.currentState.organizationId,
    });

    return this.currentState;
  }

  /**
   * Get current auth state
   */
  getState(): AuthServiceState {
    return { ...this.currentState };
  }

  /**
   * Perform login flow
   */
  async login(): Promise<AuthServiceState> {
    logger.debug("Starting login flow");

    try {
      const newAuthConfig = await doLogin();

      this.currentState = {
        authConfig: newAuthConfig,
        isAuthenticated: true,
        organizationId: newAuthConfig?.organizationId || undefined,
      };

      logger.debug("Login successful", {
        orgId: this.currentState.organizationId,
      });

      return this.currentState;
    } catch (error: any) {
      logger.error("Login failed:", error);
      throw error;
    }
  }

  /**
   * Perform logout
   */
  async logout(): Promise<AuthServiceState> {
    logger.debug("Logging out");

    doLogout();

    this.currentState = {
      authConfig: null,
      isAuthenticated: false,
      organizationId: undefined,
    };

    logger.debug("Logout complete");
    return this.currentState;
  }

  /**
   * Ensure organization is selected, prompting if necessary
   */
  async ensureOrganization(
    isHeadless: boolean = false
  ): Promise<AuthServiceState> {
    if (!this.currentState.authConfig) {
      throw new Error("Not authenticated - cannot ensure organization");
    }

    logger.debug("Ensuring organization is selected", {
      currentOrgId: this.currentState.organizationId,
      isHeadless,
    });

    const updatedConfig = await ensureOrganization(
      this.currentState.authConfig,
      isHeadless
    );

    this.currentState = {
      authConfig: updatedConfig,
      isAuthenticated: true,
      organizationId: updatedConfig?.organizationId || undefined,
    };

    logger.debug("Organization ensured", {
      orgId: this.currentState.organizationId,
    });

    return this.currentState;
  }

  /**
   * Switch to a different organization
   */
  async switchOrganization(
    organizationId: string | null
  ): Promise<AuthServiceState> {
    if (
      !this.currentState.authConfig ||
      !("userId" in this.currentState.authConfig)
    ) {
      throw new Error(
        "Not authenticated with file-based auth - cannot switch organizations"
      );
    }

    logger.debug("Switching organization", {
      from: this.currentState.organizationId,
      to: organizationId,
    });

    const authenticatedConfig = this.currentState
      .authConfig as AuthenticatedConfig;

    const updatedConfig: AuthenticatedConfig = {
      ...authenticatedConfig,
      organizationId,
    };

    saveAuthConfig(updatedConfig);

    this.currentState = {
      authConfig: updatedConfig,
      isAuthenticated: true,
      organizationId: organizationId || undefined,
    };

    logger.debug("Organization switched", {
      newOrgId: this.currentState.organizationId,
    });

    return this.currentState;
  }

  /**
   * Get available organizations for the current user
   */
  async getAvailableOrganizations(): Promise<
    { id: string; name: string }[] | null
  > {
    if (!this.currentState.isAuthenticated) {
      return null;
    }

    try {
      return await listUserOrganizations();
    } catch (error: any) {
      logger.error("Failed to list organizations:", error);
      return null;
    }
  }

  /**
   * Check if the current user has multiple organizations available
   */
  async hasMultipleOrganizations(): Promise<boolean> {
    const orgs = await this.getAvailableOrganizations();
    return orgs !== null && orgs.length > 0;
  }

  /**
   * Refresh auth state from disk (useful after external changes)
   */
  async refresh(): Promise<AuthServiceState> {
    logger.debug("Refreshing auth state from disk");
    return this.initialize();
  }
}
