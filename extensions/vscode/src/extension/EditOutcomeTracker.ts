/**
 * Tracks pending edit interactions until they are accepted or rejected,
 * then emits editOutcome events with the final result.
 */
export interface PendingEditData {
  streamId: string;
  timestamp: string;
  modelProvider: string;
  modelName: string;
  modelTitle: string;
  prompt: string;
  completion: string;
  previousCode: string;
  newCode: string;
  filepath: string;
  previousCodeLines: number;
  newCodeLines: number;
  lineChange: number;
}

class EditOutcomeTracker {
  private static instance: EditOutcomeTracker;
  private pendingEdits: Map<string, PendingEditData> = new Map();

  private constructor() {}

  public static getInstance(): EditOutcomeTracker {
    if (!EditOutcomeTracker.instance) {
      EditOutcomeTracker.instance = new EditOutcomeTracker();
    }
    return EditOutcomeTracker.instance;
  }

  /**
   * Store a pending edit interaction for later outcome tracking
   */
  public trackEditInteraction(data: PendingEditData): void {
    this.pendingEdits.set(data.streamId, data);
  }

  /**
   * Record the outcome of an edit interaction and emit the editOutcome event
   */
  public async recordEditOutcome(
    streamId: string,
    accepted: boolean,
    dataLogger: any,
  ): Promise<void> {
    const pendingEdit = this.pendingEdits.get(streamId);
    if (!pendingEdit) {
      console.warn(`No pending edit found for streamId: ${streamId}`);
      return;
    }

    // Emit the editOutcome event
    await dataLogger.logDevData({
      name: "editOutcome",
      data: {
        modelProvider: pendingEdit.modelProvider,
        modelName: pendingEdit.modelName,
        modelTitle: pendingEdit.modelName,
        prompt: pendingEdit.prompt,
        completion: pendingEdit.completion,
        previousCode: pendingEdit.previousCode,
        newCode: pendingEdit.newCode,
        previousCodeLines: pendingEdit.previousCodeLines,
        newCodeLines: pendingEdit.newCodeLines,
        lineChange: pendingEdit.lineChange,
        accepted,
        filepath: pendingEdit.filepath,
      },
    });

    // Clean up the pending edit
    this.pendingEdits.delete(streamId);
  }

  /**
   * Clean up pending edits that might have been abandoned
   */
  public cleanupOldPendingEdits(maxAgeMs: number = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [streamId, edit] of this.pendingEdits.entries()) {
      const editTime = new Date(edit.timestamp).getTime();
      if (now - editTime > maxAgeMs) {
        this.pendingEdits.delete(streamId);
      }
    }
  }

  /**
   * Get count of pending edits (for debugging/monitoring)
   */
  public getPendingEditCount(): number {
    return this.pendingEdits.size;
  }
}

export const editOutcomeTracker = EditOutcomeTracker.getInstance();
