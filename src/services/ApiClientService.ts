import { AuthConfig } from "../auth/workos.js";
import { getApiClient } from "../config.js";
import logger from "../util/logger.js";
import { ApiClientServiceState } from "./types.js";

/**
 * Service for managing API client state
 * Provides access to the Continue SDK API client
 */
export class ApiClientService {
  private currentState: ApiClientServiceState = {
    apiClient: null,
  };

  /**
   * Initialize the API client service
   */
  async initialize(authConfig: AuthConfig): Promise<ApiClientServiceState> {
    logger.debug("Initializing ApiClientService");

    try {
      const apiClient = getApiClient(authConfig?.accessToken);

      this.currentState = {
        apiClient,
      };

      logger.debug("ApiClientService initialized successfully");
      return this.currentState;
    } catch (error: any) {
      logger.error("Failed to initialize ApiClientService:", error);
      throw error;
    }
  }

  /**
   * Get current API client state
   */
  getState(): ApiClientServiceState {
    return { ...this.currentState };
  }

  /**
   * Update the API client with new auth config
   */
  async update(authConfig: AuthConfig): Promise<ApiClientServiceState> {
    logger.debug("Updating ApiClientService");

    try {
      const apiClient = getApiClient(authConfig?.accessToken);

      this.currentState = {
        apiClient,
      };

      logger.debug("ApiClientService updated successfully");
      return this.currentState;
    } catch (error: any) {
      logger.error("Failed to update ApiClientService:", error);
      throw error;
    }
  }

  /**
   * Check if the API client is ready
   */
  isReady(): boolean {
    return this.currentState.apiClient !== null;
  }
}
