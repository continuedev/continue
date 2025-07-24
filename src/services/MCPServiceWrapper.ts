import { AssistantUnrolled } from "@continuedev/config-yaml";
import { MCPService } from '../mcp.js';
import logger from '../util/logger.js';
import { MCPServiceState } from './types.js';

/**
 * Service wrapper for managing MCP service state
 * The actual MCPService is a singleton, this wrapper provides reactive updates
 */
export class MCPServiceWrapper {
  private currentState: MCPServiceState = {
    mcpService: null
  };

  /**
   * Initialize the MCP service wrapper
   */
  async initialize(assistant: AssistantUnrolled): Promise<MCPServiceState> {
    logger.debug('Initializing MCPServiceWrapper');
    
    try {
      const mcpService = await MCPService.create(assistant);

      this.currentState = {
        mcpService
      };

      logger.debug('MCPServiceWrapper initialized successfully', {
        toolCount: mcpService.getTools().length,
        promptCount: mcpService.getPrompts().length
      });

      return this.currentState;
    } catch (error: any) {
      logger.error('Failed to initialize MCPServiceWrapper:', error);
      throw error;
    }
  }

  /**
   * Get current MCP service state
   */
  getState(): MCPServiceState {
    return { ...this.currentState };
  }

  /**
   * Update the MCP service with a new assistant config
   * Note: This creates a new MCP service since the original is a singleton
   */
  async update(assistant: AssistantUnrolled): Promise<MCPServiceState> {
    logger.debug('Updating MCPServiceWrapper');
    
    try {
      // Clear the existing singleton instance to force recreation
      (MCPService as any).instance = null;
      
      const mcpService = await MCPService.create(assistant);

      this.currentState = {
        mcpService
      };

      logger.debug('MCPServiceWrapper updated successfully', {
        toolCount: mcpService.getTools().length,
        promptCount: mcpService.getPrompts().length
      });

      return this.currentState;
    } catch (error: any) {
      logger.error('Failed to update MCPServiceWrapper:', error);
      throw error;
    }
  }

  /**
   * Check if the MCP service is ready
   */
  isReady(): boolean {
    return this.currentState.mcpService !== null;
  }

  /**
   * Get MCP service information for display
   */
  getMCPInfo(): { toolCount: number; promptCount: number } | null {
    if (!this.currentState.mcpService) {
      return null;
    }

    return {
      toolCount: this.currentState.mcpService.getTools().length,
      promptCount: this.currentState.mcpService.getPrompts().length
    };
  }
}