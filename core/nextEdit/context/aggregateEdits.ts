import { RangeInFileWithContentsAndEdit } from "../..";

/**
 * Represents the state of an edit cluster
 */
interface ClusterState {
  before_state: string; // Full file content before the cluster started
  start_range: {
    min_line: number;
    max_line: number;
  };
  current_range: {
    min_line: number;
    max_line: number;
  };
  edits: RangeInFileWithContentsAndEdit[];
  first_timestamp: number;
  last_timestamp: number;
  last_line: number;
}

/**
 * Represents the state of a file being edited
 */
interface FileState {
  activeClusters: ClusterState[];
  currentContent: string; // Current full file content
  priorComparisons: string[];
  processingQueue: Array<() => Promise<void>>;
  isProcessing: boolean;
}

/**
 * Configuration for the edit clustering process
 */
export interface EditClusterConfig {
  /** Maximum time gap (seconds) between edits to consider them part of the same cluster (unless on the same line) */
  delta_t: number;
  /** Maximum line distance between edits in a cluster */
  delta_l: number;
  /** Maximum number of edits in a cluster before finalization */
  max_edits: number;
  /** Maximum duration (seconds) a cluster can remain active */
  max_duration: number;
  /** Number of prior comparisons to include as context */
  context_size: number;
  /** Maximum size of a single edit to process (larger edits are discarded) */
  max_edit_size: number;
  /** Number of unchanged lines to include as context */
  context_lines: number;
  /** Whether to log detailed information to console */
  verbose: boolean;
}

/**
 * Class that aggregates granular file edits into logical edit sequences
 * based on temporal, spatial, and line-based criteria.
 */
export class EditAggregator {
  private fileStates: Map<string, FileState> = new Map();
  private config: EditClusterConfig;
  private onComparisonFinalized: (
    filePath: string,
    beforeState: string[],
    beforeAfterComparison: string,
    contextComparisons: string[],
  ) => void;

  /**
   * Creates a new EditAggregator instance
   *
   * @param config Configuration options for edit clustering
   * @param onComparisonFinalized Callback function when a comparison is finalized
   */
  constructor(
    config: Partial<EditClusterConfig> = {},
    onComparisonFinalized: (
      filePath: string,
      beforeState: string[],
      diff: string,
      contextDiffs: string[],
    ) => void = () => {},
  ) {
    this.config = {
      delta_t: config.delta_t ?? 1.0,
      delta_l: config.delta_l ?? 5,
      max_edits: config.max_edits ?? 50,
      max_duration: config.max_duration ?? 10.0,
      context_size: config.context_size ?? 5,
      max_edit_size: config.max_edit_size ?? 1000,
      context_lines: config.context_lines ?? 3,
      verbose: config.verbose ?? false,
    };
    this.onComparisonFinalized = onComparisonFinalized;
  }

  /**
   * Queues an edit to be processed asynchronously
   *
   * @param edit The edit to process
   * @param timestamp Timestamp of the edit
   */
  async processEdit(
    edit: RangeInFileWithContentsAndEdit,
    timestamp: number = Date.now(),
  ): Promise<void> {
    const filePath = edit.filepath;

    // Initialize file state if needed
    if (!this.fileStates.has(filePath)) {
      this.fileStates.set(filePath, {
        activeClusters: [],
        currentContent: edit.fileContents,
        priorComparisons: [],
        processingQueue: [],
        isProcessing: false,
      });
    }

    const fileState = this.fileStates.get(filePath)!;

    // Create a task for processing this edit
    const task = async () => {
      await this._processEditInternal(edit, timestamp, fileState);
    };

    // Add task to queue
    fileState.processingQueue.push(task);

    // Start processing if not already in progress
    if (!fileState.isProcessing) {
      void this._processQueue(filePath);
    }
  }

  /**
   * Process the queue of edits for a file
   */
  private async _processQueue(filePath: string): Promise<void> {
    const fileState = this.fileStates.get(filePath);
    if (!fileState) return;

    fileState.isProcessing = true;

    while (fileState.processingQueue.length > 0) {
      // Get the next task
      const nextTask = fileState.processingQueue.shift();
      if (nextTask) {
        try {
          // Execute the task
          await nextTask();
        } catch (error) {
          console.error(`Error processing edit in ${filePath}:`, error);
        }

        // Small delay to allow UI updates
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    fileState.isProcessing = false;
  }

  /**
   * Internal method to process a single edit
   */
  private async _processEditInternal(
    edit: RangeInFileWithContentsAndEdit,
    timestamp: number,
    fileState: FileState,
  ): Promise<void> {
    const filePath = edit.filepath;
    const editSize = edit.editText.length;

    // Discard oversized edits
    if (editSize > this.config.max_edit_size) {
      if (this.config.verbose) {
        console.log(
          `Edit discarded: size ${editSize} exceeds max_edit_size ${this.config.max_edit_size}`,
        );
      }
      return;
    }

    const editLine = edit.range.start.line;
    const currentFileLines = fileState.currentContent.split("\n");

    // First finalize any existing clusters that meet criteria
    const clustersToFinalize = this.identifyClustersToFinalize(
      fileState,
      editLine,
      timestamp,
      false,
    );

    for (const cluster of clustersToFinalize) {
      await this.finalizeCluster(filePath, cluster, fileState);
    }

    // Find or create suitable cluster for this edit
    let suitableCluster = this.findSuitableCluster(
      fileState,
      editLine,
      timestamp,
    );

    if (!suitableCluster) {
      // Create a new cluster with the current file state
      suitableCluster = {
        before_state: fileState.currentContent,
        start_range: {
          min_line: Math.max(0, editLine - this.config.context_lines),
          max_line: Math.min(
            currentFileLines.length - 1,
            editLine + this.config.context_lines,
          ),
        },
        current_range: {
          min_line: Math.max(0, editLine - this.config.context_lines),
          max_line: Math.min(
            currentFileLines.length - 1,
            editLine + this.config.context_lines,
          ),
        },
        edits: [],
        first_timestamp: timestamp,
        last_timestamp: timestamp,
        last_line: editLine,
      };
      fileState.activeClusters.push(suitableCluster);
    }

    // Add edit to cluster and update cluster metadata
    suitableCluster.edits.push(edit);
    suitableCluster.last_timestamp = timestamp;
    suitableCluster.last_line = editLine;

    // Check if this is a meaningful edit or just whitespace
    const isWhitespaceOnly = this.isWhitespaceOnlyEdit(
      edit,
      fileState.currentContent,
    );

    // Only update the range for meaningful edits
    if (!isWhitespaceOnly) {
      // Update the current range to include this edit
      suitableCluster.current_range.min_line = Math.min(
        suitableCluster.current_range.min_line,
        Math.max(0, editLine - this.config.context_lines),
      );
      suitableCluster.current_range.max_line = Math.max(
        suitableCluster.current_range.max_line,
        Math.min(
          currentFileLines.length - 1,
          editLine + this.config.context_lines,
        ),
      );
    }

    // Update the current file content based on the edit
    fileState.currentContent = edit.fileContents;

    // Check for structural edits that might affect other clusters
    const isStructuralEdit =
      edit.editText.includes("\n") ||
      edit.range.start.line !== edit.range.end.line;

    if (isStructuralEdit) {
      // Find other clusters that might be affected by this structural edit
      const additionalClustersToFinalize = fileState.activeClusters.filter(
        (c) =>
          c !== suitableCluster && this.clustersOverlap(c, suitableCluster),
      );

      for (const cluster of additionalClustersToFinalize) {
        await this.finalizeCluster(filePath, cluster, fileState);
      }
    }

    if (this.config.verbose) {
      console.log(
        `Processed edit in ${filePath} at line ${editLine}: "${edit.editText.substring(0, 30)}${edit.editText.length > 30 ? "..." : ""}"`,
      );
    }
  }

  /**
   * Check if an edit only changes whitespace
   */
  private isWhitespaceOnlyEdit(
    edit: RangeInFileWithContentsAndEdit,
    currentContent: string,
  ): boolean {
    // Get the line before the edit
    const lines = currentContent.split("\n");
    const line = edit.range.start.line;

    if (line >= lines.length) return false;

    // For edits within a single line
    if (edit.range.start.line === edit.range.end.line) {
      const beforeEdit = lines[line];

      // Apply the edit to get the after state
      const afterEdit =
        beforeEdit.substring(0, edit.range.start.character) +
        edit.editText +
        beforeEdit.substring(edit.range.end.character);

      // Compare normalized versions
      return beforeEdit.trim() === afterEdit.trim();
    }

    return false; // Multi-line edits are considered meaningful
  }

  /**
   * Check if two clusters overlap or are close enough to affect each other
   */
  private clustersOverlap(
    cluster1: ClusterState,
    cluster2: ClusterState,
  ): boolean {
    const c1MinLine = cluster1.current_range.min_line;
    const c1MaxLine = cluster1.current_range.max_line;
    const c2MinLine = cluster2.current_range.min_line;
    const c2MaxLine = cluster2.current_range.max_line;

    // Check if the ranges overlap or are within delta_l lines of each other
    return (
      c1MinLine <= c2MaxLine + this.config.delta_l &&
      c1MaxLine >= c2MinLine - this.config.delta_l
    );
  }

  /**
   * Process multiple edits at once
   *
   * @param edits Array of edits to process
   */
  async processEdits(edits: RangeInFileWithContentsAndEdit[]): Promise<void> {
    const timestamp = Date.now();
    if (this.config.verbose) {
      console.log(`Queueing batch of ${edits.length} edits`);
    }

    // Queue all edits to be processed
    for (const edit of edits) {
      await this.processEdit(edit, timestamp);
    }
  }

  /**
   * Finalize all active clusters across all files
   */
  async finalizeAllClusters(): Promise<void> {
    if (this.config.verbose) {
      console.log("Finalizing all active clusters");
    }

    const filePromises: Promise<void>[] = [];

    this.fileStates.forEach((fileState, filePath) => {
      // Create a finalization task for each file
      const filePromise = (async () => {
        const clustersToFinalize = [...fileState.activeClusters];
        for (const cluster of clustersToFinalize) {
          await this.finalizeCluster(filePath, cluster, fileState);
        }
      })();

      filePromises.push(filePromise);
    });

    // Wait for all files to be processed
    await Promise.all(filePromises);
  }

  /**
   * Find a suitable cluster for a new edit based on temporal and spatial proximity
   *
   * @param fileState Current state of the file
   * @param editLine Line number of the edit
   * @param timestamp Timestamp of the edit
   * @returns A suitable cluster or null if none found
   */
  private findSuitableCluster(
    fileState: FileState,
    editLine: number,
    timestamp: number,
  ): ClusterState | null {
    for (const cluster of fileState.activeClusters) {
      // Edit is on the same line as the last edit in the cluster
      const isOnSameLine = editLine === cluster.last_line;

      // Edit is within time window of the last edit in the cluster
      const isWithinTimeWindow =
        (timestamp - cluster.last_timestamp) / 1000 <= this.config.delta_t;

      // Edit is within line range of the cluster
      const isWithinLineRange =
        editLine >= cluster.current_range.min_line - this.config.delta_l &&
        editLine <= cluster.current_range.max_line + this.config.delta_l;

      // Cluster hasn't reached max edits
      const isWithinEditLimit = cluster.edits.length < this.config.max_edits;

      // Cluster hasn't reached max duration
      const isWithinDurationLimit =
        (timestamp - cluster.first_timestamp) / 1000 <=
        this.config.max_duration;

      if (
        (isOnSameLine || (isWithinTimeWindow && isWithinLineRange)) &&
        isWithinEditLimit &&
        isWithinDurationLimit
      ) {
        return cluster;
      }
    }
    return null;
  }

  /**
   * Identify clusters that should be finalized based on clustering rules
   *
   * @param fileState Current state of the file
   * @param editLine Line number of the current edit
   * @param timestamp Timestamp of the current edit
   * @param isStructuralEdit Whether the edit changes line structure
   * @returns Array of clusters to finalize
   */
  private identifyClustersToFinalize(
    fileState: FileState,
    editLine: number,
    timestamp: number,
    isStructuralEdit: boolean,
  ): ClusterState[] {
    const clustersToFinalize: ClusterState[] = [];

    fileState.activeClusters.forEach((cluster) => {
      const timeSinceLastEdit = (timestamp - cluster.last_timestamp) / 1000;

      // Important fix: Only consider the line changed if it's a DIFFERENT line
      // This way, continuing to edit the same line won't finalize the cluster
      const isOnDifferentLine = cluster.last_line !== editLine;

      // Only finalize if we moved to a different line AND the time gap exceeds delta_t
      const shouldFinalizeByTime =
        isOnDifferentLine && timeSinceLastEdit > this.config.delta_t;

      // Finalize if cluster reached max edits
      const shouldFinalizeByCount =
        cluster.edits.length >= this.config.max_edits;

      // Finalize if cluster reached max duration
      const shouldFinalizeByDuration =
        (timestamp - cluster.first_timestamp) / 1000 > this.config.max_duration;

      // Structural edits should only finalize other clusters, not their own
      const shouldFinalizeByStructuralEdit =
        isStructuralEdit && isOnDifferentLine;

      if (
        shouldFinalizeByTime ||
        shouldFinalizeByCount ||
        shouldFinalizeByDuration ||
        shouldFinalizeByStructuralEdit
      ) {
        clustersToFinalize.push(cluster);
      }
    });

    return clustersToFinalize;
  }

  /**
   * Create a console-friendly side-by-side comparison of the edited region with context
   */
  private async createConsoleComparison(
    beforeContent: string,
    afterContent: string,
    filePath: string,
  ): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const beforeLines = beforeContent.split("\n");
        const afterLines = afterContent.split("\n");

        // Find the first and last lines that differ
        const maxLines = Math.max(beforeLines.length, afterLines.length);
        let firstDiffLine = maxLines;
        let lastDiffLine = 0;

        for (let i = 0; i < maxLines; i++) {
          const beforeLine = i < beforeLines.length ? beforeLines[i] : "";
          const afterLine = i < afterLines.length ? afterLines[i] : "";

          if (beforeLine !== afterLine) {
            firstDiffLine = Math.min(firstDiffLine, i);
            lastDiffLine = Math.max(lastDiffLine, i);
          }
        }

        // If no differences found, show a small section from the beginning
        if (firstDiffLine > lastDiffLine) {
          firstDiffLine = 0;
          lastDiffLine = Math.min(5, maxLines - 1);
        }

        // Add context lines (3 lines on either side)
        const contextLines = 3;
        const startLine = Math.max(0, firstDiffLine - contextLines);
        const endLine = Math.min(maxLines - 1, lastDiffLine + contextLines);

        let result = `\n=== File: ${filePath} ===\n`;
        result += `=== Diff view of lines ${startLine}-${endLine} ===\n\n`;

        // Calculate width for line numbers
        const lineNumWidth = String(endLine).length;

        // Max width for content columns (adjust based on your terminal width)
        const contentWidth = 60;

        // Table header
        result += `${"LINE".padEnd(lineNumWidth + 2)} | ${"BEFORE".padEnd(contentWidth)} | ${"AFTER".padEnd(contentWidth)}\n`;
        result += `${"-".repeat(lineNumWidth + 2)}-|-${"-".repeat(contentWidth)}-|-${"-".repeat(contentWidth)}\n`;

        // Generate the comparison for the specified range
        for (let i = startLine; i <= endLine; i++) {
          const beforeLine = i < beforeLines.length ? beforeLines[i] : "";
          const afterLine = i < afterLines.length ? afterLines[i] : "";

          // Truncate long lines
          const truncatedBeforeLine =
            beforeLine.length > contentWidth - 3
              ? beforeLine.substring(0, contentWidth - 3) + "..."
              : beforeLine;

          const truncatedAfterLine =
            afterLine.length > contentWidth - 3
              ? afterLine.substring(0, contentWidth - 3) + "..."
              : afterLine;

          // Mark changed lines with asterisk
          const changed = beforeLine !== afterLine ? "* " : "  ";
          const lineNum = String(i).padStart(lineNumWidth);

          result += `${changed}${lineNum} | ${truncatedBeforeLine.padEnd(contentWidth)} | ${truncatedAfterLine.padEnd(contentWidth)}\n`;
        }

        result += "\n";
        resolve(result);
      }, 0);
    });
  }

  /**
   * Finalize a cluster, generating a comparison and removing it from active clusters
   */
  private async finalizeCluster(
    filePath: string,
    cluster: ClusterState,
    fileState: FileState,
  ): Promise<void> {
    // Create a console-friendly comparison of the before and after states
    const beforeContent = cluster.before_state;
    const afterContent = fileState.currentContent;

    // Generate comparison asynchronously
    const comparison = await this.createConsoleComparison(
      beforeContent,
      afterContent,
      filePath,
    );

    // Add to prior comparisons and maintain context size limit
    fileState.priorComparisons.push(comparison);
    if (fileState.priorComparisons.length > this.config.context_size) {
      fileState.priorComparisons.shift();
    }

    // Convert before state to array for callback
    const beforeStateArray = cluster.before_state.split("\n");

    // Log the finalized comparison
    console.log("\n========== FINALIZED EDIT CLUSTER ==========");
    console.log(`File: ${filePath}`);
    console.log(`Number of edits: ${cluster.edits.length}`);
    console.log(`First edit at line: ${cluster.edits[0]?.range.start.line}`);
    console.log(
      `Last edit at line: ${cluster.edits[cluster.edits.length - 1]?.range.start.line}`,
    );
    console.log(
      `Duration: ${((cluster.last_timestamp - cluster.first_timestamp) / 1000).toFixed(2)}s`,
    );
    console.log(comparison);
    console.log("===========================================\n");

    // Call the finalization callback with the generated comparison and context
    this.onComparisonFinalized(filePath, beforeStateArray, comparison, [
      ...fileState.priorComparisons,
    ]);

    // Remove cluster from active clusters
    const clusterIndex = fileState.activeClusters.indexOf(cluster);
    if (clusterIndex !== -1) {
      fileState.activeClusters.splice(clusterIndex, 1);
    }
  }
}
