import { RangeInFileWithContentsAndEdit } from "../..";

interface ClusterState {
  beforeState: string;
  startRange: { minLine: number; maxLine: number };
  currentRange: { minLine: number; maxLine: number };
  edits: RangeInFileWithContentsAndEdit[];
  firstTimestamp: number;
  lastTimestamp: number;
  lastLine: number;
}

interface FileState {
  activeClusters: ClusterState[];
  currentContent: string;
  priorComparisons: string[];
  processingQueue: Array<() => Promise<void>>;
  isProcessing: boolean;
}

export interface EditClusterConfig {
  deltaT: number;
  deltaL: number;
  maxEdits: number;
  maxDuration: number;
  contextSize: number;
  maxEditSize: number;
  contextLines: number;
  verbose: boolean;
}

export class EditAggregator {
  private fileStates: Map<string, FileState> = new Map();
  private config: EditClusterConfig;
  private onComparisonFinalized: (
    filePath: string,
    beforeState: string[],
    beforeAfterComparison: string,
    contextComparisons: string[],
  ) => void;

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
      deltaT: config.deltaT ?? 1.0,
      deltaL: config.deltaL ?? 5,
      maxEdits: config.maxEdits ?? 200,
      maxDuration: config.maxDuration ?? 20.0,
      contextSize: config.contextSize ?? 5,
      maxEditSize: config.maxEditSize ?? 1000,
      contextLines: config.contextLines ?? 3,
      verbose: config.verbose ?? false,
    };
    this.onComparisonFinalized = onComparisonFinalized;
  }

  async processEdit(
    edit: RangeInFileWithContentsAndEdit,
    timestamp: number = Date.now(),
  ): Promise<void> {
    const filePath = edit.filepath;

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
    const task = async () => {
      await this._processEditInternal(edit, timestamp, fileState);
    };

    fileState.processingQueue.push(task);

    if (!fileState.isProcessing) {
      void this._processQueue(filePath);
    }
  }

  private async _processQueue(filePath: string): Promise<void> {
    const fileState = this.fileStates.get(filePath);
    if (!fileState) return;

    fileState.isProcessing = true;

    while (fileState.processingQueue.length > 0) {
      const nextTask = fileState.processingQueue.shift();
      if (nextTask) {
        try {
          await nextTask();
        } catch (error) {
          console.error(`Error processing edit in ${filePath}:`, error);
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    fileState.isProcessing = false;
  }

  private async _processEditInternal(
    edit: RangeInFileWithContentsAndEdit,
    timestamp: number,
    fileState: FileState,
  ): Promise<void> {
    const filePath = edit.filepath;

    if (edit.editText.length > this.config.maxEditSize) {
      if (this.config.verbose) {
        console.log(
          `Edit discarded: size ${edit.editText.length} exceeds max_edit_size ${this.config.maxEditSize}`,
        );
      }
      return;
    }

    const editLine = edit.range.start.line;
    const currentFileLines = fileState.currentContent.split("\n");

    const clustersToFinalize = this.identifyClustersToFinalize(
      fileState,
      editLine,
      timestamp,
      false,
    );

    for (const cluster of clustersToFinalize) {
      await this.finalizeCluster(filePath, cluster, fileState);
    }

    let suitableCluster = this.findSuitableCluster(
      fileState,
      editLine,
      timestamp,
    );

    if (!suitableCluster) {
      suitableCluster = {
        beforeState: fileState.currentContent,
        startRange: {
          minLine: Math.max(0, editLine - this.config.contextLines),
          maxLine: Math.min(
            currentFileLines.length - 1,
            editLine + this.config.contextLines,
          ),
        },
        currentRange: {
          minLine: Math.max(0, editLine - this.config.contextLines),
          maxLine: Math.min(
            currentFileLines.length - 1,
            editLine + this.config.contextLines,
          ),
        },
        edits: [],
        firstTimestamp: timestamp,
        lastTimestamp: timestamp,
        lastLine: editLine,
      };
      fileState.activeClusters.push(suitableCluster);
    }

    suitableCluster.edits.push(edit);
    suitableCluster.lastTimestamp = timestamp;
    suitableCluster.lastLine = editLine;

    const isWhitespaceOnly = this.isWhitespaceOnlyEdit(
      edit,
      fileState.currentContent,
    );

    if (!isWhitespaceOnly) {
      suitableCluster.currentRange.minLine = Math.min(
        suitableCluster.currentRange.minLine,
        Math.max(0, editLine - this.config.contextLines),
      );
      suitableCluster.currentRange.maxLine = Math.max(
        suitableCluster.currentRange.maxLine,
        Math.min(
          currentFileLines.length - 1,
          editLine + this.config.contextLines,
        ),
      );
    }

    fileState.currentContent = edit.fileContents;

    const isStructuralEdit =
      edit.editText.includes("\n") ||
      edit.range.start.line !== edit.range.end.line;

    if (isStructuralEdit) {
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

  private isWhitespaceOnlyEdit(
    edit: RangeInFileWithContentsAndEdit,
    currentContent: string,
  ): boolean {
    const lines = currentContent.split("\n");
    const line = edit.range.start.line;

    if (line >= lines.length) return false;

    if (edit.range.start.line === edit.range.end.line) {
      const beforeEdit = lines[line];
      const afterEdit =
        beforeEdit.substring(0, edit.range.start.character) +
        edit.editText +
        beforeEdit.substring(edit.range.end.character);

      return beforeEdit.trim() === afterEdit.trim();
    }

    return false;
  }

  private clustersOverlap(
    cluster1: ClusterState,
    cluster2: ClusterState,
  ): boolean {
    return (
      cluster1.currentRange.minLine <=
        cluster2.currentRange.maxLine + this.config.deltaL &&
      cluster1.currentRange.maxLine >=
        cluster2.currentRange.minLine - this.config.deltaL
    );
  }

  async processEdits(edits: RangeInFileWithContentsAndEdit[]): Promise<void> {
    const timestamp = Date.now();
    if (this.config.verbose) {
      console.log(`Queueing batch of ${edits.length} edits`);
    }

    for (const edit of edits) {
      await this.processEdit(edit, timestamp);
    }
  }

  async finalizeAllClusters(): Promise<void> {
    if (this.config.verbose) {
      console.log("Finalizing all active clusters");
    }

    const filePromises: Promise<void>[] = [];

    this.fileStates.forEach((fileState, filePath) => {
      const filePromise = (async () => {
        const clustersToFinalize = [...fileState.activeClusters];
        for (const cluster of clustersToFinalize) {
          await this.finalizeCluster(filePath, cluster, fileState);
        }
      })();

      filePromises.push(filePromise);
    });

    await Promise.all(filePromises);
  }

  private findSuitableCluster(
    fileState: FileState,
    editLine: number,
    timestamp: number,
  ): ClusterState | null {
    // First check if we need to finalize any clusters due to line jumps
    const activeClusters = [...fileState.activeClusters];

    for (const cluster of activeClusters) {
      // If we're outside the line range but within the time window,
      // we should finalize the current cluster
      const isOutsideLineRange =
        editLine < cluster.currentRange.minLine - this.config.deltaL ||
        editLine > cluster.currentRange.maxLine + this.config.deltaL;

      const isWithinTimeWindow =
        (timestamp - cluster.lastTimestamp) / 1000 <= this.config.deltaT;

      // If user quickly jumped far away, finalize this cluster before continuing
      if (isOutsideLineRange && isWithinTimeWindow) {
        void this.finalizeCluster(
          cluster.edits[0].filepath,
          cluster,
          fileState,
        );
      }
    }

    // Now look for a suitable cluster for the new edit
    for (const cluster of fileState.activeClusters) {
      const isOnSameLine = editLine === cluster.lastLine;
      const isWithinTimeWindow =
        (timestamp - cluster.lastTimestamp) / 1000 <= this.config.deltaT;
      const isWithinLineRange =
        editLine >= cluster.currentRange.minLine - this.config.deltaL &&
        editLine <= cluster.currentRange.maxLine + this.config.deltaL;
      const isWithinEditLimit = cluster.edits.length < this.config.maxEdits;
      const isWithinDurationLimit =
        (timestamp - cluster.firstTimestamp) / 1000 <= this.config.maxDuration;

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

  private identifyClustersToFinalize(
    fileState: FileState,
    editLine: number,
    timestamp: number,
    isStructuralEdit: boolean,
  ): ClusterState[] {
    const clustersToFinalize: ClusterState[] = [];

    fileState.activeClusters.forEach((cluster) => {
      const timeSinceLastEdit = (timestamp - cluster.lastTimestamp) / 1000;

      // Important fix: Only consider the line changed if it's a DIFFERENT line
      // This way, continuing to edit the same line won't finalize the cluster
      const isOnDifferentLine = cluster.lastLine !== editLine;

      // Only finalize if we moved to a different line AND the time gap exceeds deltaT
      const shouldFinalizeByTime =
        isOnDifferentLine && timeSinceLastEdit > this.config.deltaT;

      const shouldFinalizeByCount =
        cluster.edits.length >= this.config.maxEdits;

      const shouldFinalizeByDuration =
        (timestamp - cluster.firstTimestamp) / 1000 > this.config.maxDuration;

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

        if (this.config.verbose || true) {
          const reasons = [];
          if (shouldFinalizeByTime)
            reasons.push(
              `time gap (${timeSinceLastEdit.toFixed(2)}s > ${this.config.deltaT}s)`,
            );
          if (shouldFinalizeByCount)
            reasons.push(
              `edit count (${cluster.edits.length} >= ${this.config.maxEdits})`,
            );
          if (shouldFinalizeByDuration)
            reasons.push(
              `duration (${((timestamp - cluster.firstTimestamp) / 1000).toFixed(2)}s > ${this.config.maxDuration}s)`,
            );
          if (shouldFinalizeByStructuralEdit)
            reasons.push("structural edit on different line");
          console.log(
            `Finalizing cluster in ${cluster.edits[0].filepath} due to: ${reasons.join(", ")}`,
          );
        }
      }
    });

    return clustersToFinalize;
  }

  private async createConsoleComparison(
    beforeContent: string,
    afterContent: string,
    filePath: string,
  ): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const beforeLines = beforeContent.split("\n");
        const afterLines = afterContent.split("\n");
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

        if (firstDiffLine > lastDiffLine) {
          firstDiffLine = 0;
          lastDiffLine = Math.min(5, maxLines - 1);
        }

        const contextLines = 3;
        const startLine = Math.max(0, firstDiffLine - contextLines);
        const endLine = Math.min(maxLines - 1, lastDiffLine + contextLines);
        const lineNumWidth = String(endLine).length;
        const contentWidth = 60;

        let result = `\n=== File: ${filePath} ===\n`;
        result += `=== Diff view of lines ${startLine}-${endLine} ===\n\n`;
        result += `${"LINE".padEnd(lineNumWidth + 2)} | ${"BEFORE".padEnd(contentWidth)} | ${"AFTER".padEnd(contentWidth)}\n`;
        result += `${"-".repeat(lineNumWidth + 2)}-|-${"-".repeat(contentWidth)}-|-${"-".repeat(contentWidth)}\n`;

        for (let i = startLine; i <= endLine; i++) {
          const beforeLine = i < beforeLines.length ? beforeLines[i] : "";
          const afterLine = i < afterLines.length ? afterLines[i] : "";
          const truncatedBeforeLine =
            beforeLine.length > contentWidth - 3
              ? beforeLine.substring(0, contentWidth - 3) + "..."
              : beforeLine;
          const truncatedAfterLine =
            afterLine.length > contentWidth - 3
              ? afterLine.substring(0, contentWidth - 3) + "..."
              : afterLine;
          const changed = beforeLine === afterLine ? "  " : "* ";
          const lineNum = String(i).padStart(lineNumWidth);

          result += `${changed}${lineNum} | ${truncatedBeforeLine.padEnd(contentWidth)} | ${truncatedAfterLine.padEnd(contentWidth)}\n`;
        }

        result += "\n";
        resolve(result);
      }, 0);
    });
  }

  private async finalizeCluster(
    filePath: string,
    cluster: ClusterState,
    fileState: FileState,
  ): Promise<void> {
    const beforeContent = cluster.beforeState;
    const afterContent = fileState.currentContent;
    const comparison = await this.createConsoleComparison(
      beforeContent,
      afterContent,
      filePath,
    );

    fileState.priorComparisons.push(comparison);
    if (fileState.priorComparisons.length > this.config.contextSize) {
      fileState.priorComparisons.shift();
    }

    const beforeStateArray = cluster.beforeState.split("\n");

    console.log("\n========== FINALIZED EDIT CLUSTER ==========");
    console.log(`File: ${filePath}`);
    console.log(`Number of edits: ${cluster.edits.length}`);
    console.log(`First edit at line: ${cluster.edits[0]?.range.start.line}`);
    console.log(
      `Last edit at line: ${cluster.edits[cluster.edits.length - 1]?.range.start.line}`,
    );
    console.log(
      `Duration: ${(cluster.lastTimestamp - cluster.firstTimestamp) / 1000}s`,
    );
    console.log(comparison);
    console.log("===========================================\n");

    fileState.activeClusters = fileState.activeClusters.filter(
      (c) => c !== cluster,
    );

    this.onComparisonFinalized(filePath, beforeStateArray, comparison, [
      ...fileState.priorComparisons,
    ]);
  }

  getActiveClusterCount(): number {
    let count = 0;
    this.fileStates.forEach((fileState) => {
      count += fileState.activeClusters.length;
    });
    return count;
  }

  getProcessingQueueSize(): number {
    let count = 0;
    this.fileStates.forEach((fileState) => {
      count += fileState.processingQueue.length;
    });
    return count;
  }

  resetState(): void {
    this.fileStates.clear();
  }
}
