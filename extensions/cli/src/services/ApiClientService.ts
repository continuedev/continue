import { AuthConfig } from "../auth/workos.js";
import { getApiClient } from "../config.js";
import { logger } from "../util/logger.js";

import { BaseService, ServiceWithDependencies } from "./BaseService.js";
import { ApiClientServiceState } from "./types.js";

/**
 * Service for managing API client state
 * Provides access to the Continue SDK API client
 */
export class ApiClientService
  extends BaseService<ApiClientServiceState>
  implements ServiceWithDependencies
{
  constructor() {
    super("ApiClientService", {
      apiClient: null,
    });
  }

  /**
   * Declare dependencies on other services
   */
  getDependencies(): string[] {
    return ["auth"];
  }

  /**
   * Initialize the API client service
   */
  async doInitialize(authConfig: AuthConfig): Promise<ApiClientServiceState> {
    const apiClient = getApiClient(authConfig?.accessToken);

    return {
      apiClient,
    };
  }

  /**
   * Update the API client with new auth config
   */
  async update(authConfig: AuthConfig): Promise<ApiClientServiceState> {
    logger.debug("Updating ApiClientService");

    try {
      const apiClient = getApiClient(authConfig?.accessToken);

      this.setState({
        apiClient,
      });

      logger.debug("ApiClientService updated successfully");
      return this.getState();
    } catch (error: any) {
      logger.error("Failed to update ApiClientService:", error);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Override isReady to check for API client
   */
  override isReady(): boolean {
    return super.isReady() && this.currentState.apiClient !== null;
  }
}
