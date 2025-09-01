/**
 * ChatHistoryServiceWrapper - Phase 2 Compatibility Layer
 * 
 * This wrapper provides a bridge between the old React state-based chat history
 * and the new ChatHistoryService. It allows for gradual migration by:
 * 1. Intercepting setState calls and syncing to the service
 * 2. Subscribing to service changes and updating React state
 * 3. Providing a migration path without breaking existing code
 */

import type { ChatHistoryItem } from "core/index.js";
import { Dispatch, SetStateAction } from "react";

import { logger } from "../util/logger.js";

import { ChatHistoryService } from "./ChatHistoryService.js";

export type SetChatHistoryFunction = Dispatch<SetStateAction<ChatHistoryItem[]>>;

export class ChatHistoryServiceWrapper {
  private service: ChatHistoryService;
  private originalSetState: SetChatHistoryFunction | null = null;
  private isServiceUpdate = false; // Flag to prevent infinite loops
  private unsubscribe: (() => void) | null = null;

  constructor(service: ChatHistoryService) {
    this.service = service;
  }

  /**
   * Creates a wrapped setState function that syncs with the service
   */
  createWrappedSetState(originalSetState: SetChatHistoryFunction): SetChatHistoryFunction {
    this.originalSetState = originalSetState;
    
    return (value: SetStateAction<ChatHistoryItem[]>) => {
      // If this update is coming from the service, just pass through
      if (this.isServiceUpdate) {
        originalSetState(value);
        return;
      }

      // Handle both function and direct value updates
      const newHistory = typeof value === 'function' 
        ? value(this.service.getHistory())
        : value;

      // Sync to service
      try {
        this.service.setHistory(newHistory);
        logger.debug('Synced React state to ChatHistoryService', {
          historyLength: newHistory.length
        });
      } catch (error) {
        logger.error('Failed to sync to ChatHistoryService', { error });
      }

      // Update React state
      originalSetState(newHistory);
    };
  }

  /**
   * Sets up bidirectional sync between React state and service
   */
  setupSync(setChatHistory: SetChatHistoryFunction): void {
    // Subscribe to service changes and update React state
    const listener = () => {
      this.isServiceUpdate = true;
      try {
        const history = this.service.getHistory();
        setChatHistory(history);
        logger.debug('Synced ChatHistoryService to React state', {
          historyLength: history.length
        });
      } finally {
        this.isServiceUpdate = false;
      }
    };

    this.service.on('stateChanged', listener);
    
    // Store unsubscribe function
    this.unsubscribe = () => {
      this.service.off('stateChanged', listener);
    };
  }

  /**
   * Initializes the service with existing history
   */
  initializeFromState(history: ChatHistoryItem[]): void {
    if (history.length > 0) {
      this.service.setHistory(history);
      logger.debug('Initialized ChatHistoryService from React state', {
        historyLength: history.length
      });
    }
  }

  /**
   * Cleans up subscriptions
   */
  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Get the underlying service for direct access when needed
   */
  getService(): ChatHistoryService {
    return this.service;
  }
}