import { createPatch } from "diff";
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
  private onComparisonFinalized: (diff: string) => void;

  constructor(
    config: Partial<EditClusterConfig> = {},
    onComparisonFinalized: (diff: string) => void = () => {},
  ) {
    this.config = {
      deltaT: config.deltaT ?? 1.0,
      deltaL: config.deltaL ?? 5,
      maxEdits: config.maxEdits ?? 500,
      maxDuration: config.maxDuration ?? 10.0,
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

    // Process chunks of (5) edits instead of one at a time
    while (fileState.processingQueue.length > 0) {
      const tasks = fileState.processingQueue.splice(0, 5);
      if (tasks.length > 0) {
        try {
          await Promise.all(tasks.map((task) => task()));
        } catch (error) {
          console.error(`Error processing edits in ${filePath}:`, error);
        }

        // Yield to the event loop to prevent blocking
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

    const editSize = edit.editText.length;
    if (editSize > this.config.maxEditSize) {
      console.log(
        `Large edit discarded: size ${editSize} characters exceeds max_edit_size ${this.config.maxEditSize}`,
      );
      return; // Exit early without processing this edit
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

    // Skip processing during rapid typing
    if (this.getProcessingQueueSize() > 15) {
      // Only process the last edit
      if (edits.length > 0) {
        await this.processEdit(edits[edits.length - 1], timestamp);
      }
      return;
    }

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
          console.log(`Finalizing cluster due to: ${reasons.join(", ")}`);
        }
      }
    });

    return clustersToFinalize;
  }

  private createStandardDiff(
    beforeContent: string,
    afterContent: string,
    filePath: string,
  ): string {
    const normalizedBefore = beforeContent.endsWith("\n")
      ? beforeContent
      : beforeContent + "\n";
    const normalizedAfter = afterContent.endsWith("\n")
      ? afterContent
      : afterContent + "\n";

    const patch = createPatch(
      filePath,
      normalizedBefore,
      normalizedAfter,
      "before",
      "after",
      { context: 3 },
    );

    return patch;
  }

  private async finalizeCluster(
    filePath: string,
    cluster: ClusterState,
    fileState: FileState,
  ): Promise<void> {
    const beforeContent = cluster.beforeState;
    const afterContent = fileState.currentContent;

    // Skip whitespace-only diffs
    const isWhitespaceOnlyDiff =
      beforeContent.replace(/\s+/g, "") === afterContent.replace(/\s+/g, "");

    if (isWhitespaceOnlyDiff) {
      if (this.config.verbose) {
        console.log(`Skipping W H I T E S P A C E -only diff in ${filePath}`);
      }
      fileState.activeClusters = fileState.activeClusters.filter(
        (c) => c !== cluster,
      );
      return;
    }

    const diff = this.createStandardDiff(beforeContent, afterContent, filePath);

    // Skip diffs with too many changed lines
    const changedLineCount = this.countChangedLines(diff);
    if (changedLineCount > this.config.deltaL * 2) {
      if (this.config.verbose) {
        console.log(
          `Skipping diff with ${changedLineCount} changed lines (> ${this.config.deltaL}) in ${filePath}`,
        );
      }
      fileState.activeClusters = fileState.activeClusters.filter(
        (c) => c !== cluster,
      );
      return;
    }

    fileState.priorComparisons.push(diff);
    if (fileState.priorComparisons.length > this.config.contextSize) {
      fileState.priorComparisons.shift();
    }

    console.log("\n========== FINALIZED EDIT CLUSTER ==========");
    // console.log(`File: ${filePath}`);
    // console.log(`Number of edits: ${cluster.edits.length}`);
    // console.log(`First edit at line: ${cluster.edits[0]?.range.start.line}`);
    // console.log(
    //   `Last edit at line: ${cluster.edits[cluster.edits.length - 1]?.range.start.line}`,
    // );
    // console.log(
    //   `Duration: ${(cluster.lastTimestamp - cluster.firstTimestamp) / 1000}s`,
    // );
    console.log(diff);
    console.log("===========================================\n");

    fileState.activeClusters = fileState.activeClusters.filter(
      (c) => c !== cluster,
    );

    this.onComparisonFinalized(diff);
  }

  private countChangedLines(diff: string): number {
    let count = 0;
    let addedLines = new Set<number>();
    let removedLines = new Set<number>();

    // Parse the diff lines
    const lines = diff.split("\n");
    for (const line of lines) {
      if (
        line.startsWith("+++ ") ||
        line.startsWith("--- ") ||
        line.startsWith("@@")
      ) {
        continue; // Skip header lines
      }

      if (line.startsWith("+")) {
        addedLines.add(count);
        count++;
      } else if (line.startsWith("-")) {
        removedLines.add(count);
        count++;
      }
    }

    return Math.max(addedLines.size, removedLines.size);
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
