import type {
  VSCodeBridgePermissionCancellation,
  VSCodeBridgePermissionRequest,
  VSCodeBridgePermissionResponse,
  VSCodeBridgePermissionResult,
} from "core/agent/contracts/index.js";

interface PendingPermissionCallback {
  request: VSCodeBridgePermissionRequest;
  resolve: (result: VSCodeBridgePermissionResult) => void;
  onCancel?: (cancellation: VSCodeBridgePermissionCancellation) => void;
}

export class PermissionCallbacks {
  private readonly pending = new Map<string, PendingPermissionCallback>();

  register(
    request: VSCodeBridgePermissionRequest,
    options?: {
      onCancel?: (cancellation: VSCodeBridgePermissionCancellation) => void;
    },
  ): Promise<VSCodeBridgePermissionResult> {
    if (this.pending.has(request.requestId)) {
      throw new Error(
        `Permission callback already registered for ${request.requestId}`,
      );
    }

    return new Promise((resolve) => {
      this.pending.set(request.requestId, {
        request,
        resolve,
        onCancel: options?.onCancel,
      });
    });
  }

  resolve(response: VSCodeBridgePermissionResponse): boolean {
    const pending = this.pending.get(response.requestId);
    if (!pending) {
      return false;
    }

    this.pending.delete(response.requestId);
    pending.resolve({
      success: true,
      requestId: response.requestId,
      approved: response.approved,
    });
    return true;
  }

  cancel(cancellation: VSCodeBridgePermissionCancellation | string): boolean {
    const normalized =
      typeof cancellation === "string"
        ? { requestId: cancellation }
        : cancellation;

    const pending = this.pending.get(normalized.requestId);
    if (!pending) {
      return false;
    }

    this.pending.delete(normalized.requestId);
    pending.onCancel?.(normalized);
    pending.resolve({
      success: false,
      requestId: normalized.requestId,
      approved: false,
      cancelled: true,
      reason: normalized.reason,
    });
    return true;
  }

  cancelAll(reason = "cancelled"): string[] {
    const requestIds = Array.from(this.pending.keys());
    for (const requestId of requestIds) {
      this.cancel({ requestId, reason });
    }
    return requestIds;
  }

  getPendingRequest(
    requestId: string,
  ): VSCodeBridgePermissionRequest | undefined {
    return this.pending.get(requestId)?.request;
  }

  getPendingRequests(): VSCodeBridgePermissionRequest[] {
    return Array.from(this.pending.values(), ({ request }) => request);
  }

  has(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  get size(): number {
    return this.pending.size;
  }
}
