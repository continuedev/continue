import { EventEmitter } from "events";

import { ToolCallRequest } from "./types.js";

export interface PermissionRequestResult {
  approved: boolean;
  remember?: boolean; // For future implementation - remember this decision
}

export class ToolPermissionManager extends EventEmitter {
  private pendingRequests = new Map<
    string,
    {
      toolCall: ToolCallRequest;
      resolve: (result: PermissionRequestResult) => void;
    }
  >();

  private requestCounter = 0;

  /**
   * Request permission for a tool call. Returns a promise that resolves
   * when the user approves or rejects the request.
   */
  async requestPermission(
    toolCall: ToolCallRequest,
  ): Promise<PermissionRequestResult> {
    const requestId = `tool-request-${++this.requestCounter}`;

    return new Promise<PermissionRequestResult>((resolve) => {
      this.pendingRequests.set(requestId, {
        toolCall,
        resolve,
      });

      // Emit event for UI to handle
      this.emit("permissionRequested", {
        requestId,
        toolCall,
      });
    });
  }

  /**
   * Approve a pending permission request
   */
  approveRequest(requestId: string, remember = false): boolean {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      // Also try to emit for the new event-based system
      this.emit("permissionResponse", { requestId, approved: true });
      return false;
    }

    this.pendingRequests.delete(requestId);
    request.resolve({ approved: true, remember });

    // Also emit for the new event-based system
    this.emit("permissionResponse", { requestId, approved: true });
    return true;
  }

  /**
   * Reject a pending permission request
   */
  rejectRequest(requestId: string): boolean {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      // Also try to emit for the new event-based system
      this.emit("permissionResponse", { requestId, approved: false });
      return false;
    }

    this.pendingRequests.delete(requestId);
    request.resolve({ approved: false });

    // Also emit for the new event-based system
    this.emit("permissionResponse", { requestId, approved: false });
    return true;
  }

  /**
   * Get details of a pending request
   */
  getPendingRequest(requestId: string) {
    return this.pendingRequests.get(requestId);
  }

  /**
   * Get all pending request IDs
   */
  getPendingRequestIds(): string[] {
    return Array.from(this.pendingRequests.keys());
  }
}

// Global instance
export const toolPermissionManager = new ToolPermissionManager();
