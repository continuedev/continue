import { spawn, type ChildProcess } from "child_process";

import { BaseService } from "./BaseService.js";
import { getShellCommand } from "../tools/runTerminalCommand.js";
import { logger } from "../util/logger.js";

class CircularBuffer {
  private buffer: string[] = [];
  private maxLines: number;
  private maxLineLength: number;
  private totalLinesWritten: number = 0;
  private startIndex: number = 0; // Where the buffer logically starts

  constructor(maxLines = 10000, maxLineLength = 2000) {
    this.maxLines = maxLines;
    this.maxLineLength = maxLineLength;
  }

  append(line: string): void {
    // Truncate line if too long
    const truncatedLine =
      line.length > this.maxLineLength
        ? line.substring(0, this.maxLineLength) + "..."
        : line;

    if (this.buffer.length < this.maxLines) {
      // Buffer not full yet
      this.buffer.push(truncatedLine);
    } else {
      // Buffer is full, overwrite oldest
      const writeIndex = this.startIndex % this.maxLines;
      this.buffer[writeIndex] = truncatedLine;
      this.startIndex++;
    }

    this.totalLinesWritten++;
  }

  getLines(fromLine?: number): string[] {
    const from = fromLine ?? 0;

    // If requesting lines before buffer start, clamp to start
    const effectiveFrom = Math.max(
      from,
      this.totalLinesWritten - this.buffer.length,
    );

    // If requesting lines beyond what we've written, return empty
    if (effectiveFrom >= this.totalLinesWritten) {
      return [];
    }

    const startOffset =
      effectiveFrom - (this.totalLinesWritten - this.buffer.length);
    const endOffset =
      this.totalLinesWritten - (this.totalLinesWritten - this.buffer.length);

    // Handle circular buffer reading
    if (this.buffer.length < this.maxLines) {
      // Buffer not full yet, simple slice
      return this.buffer.slice(startOffset);
    } else {
      // Buffer is full and circular
      const physicalStart = this.startIndex % this.maxLines;
      const logicalStart = startOffset;
      const count = endOffset - startOffset;

      const result: string[] = [];
      for (let i = 0; i < count; i++) {
        const physicalIndex =
          (physicalStart + logicalStart + i) % this.maxLines;
        result.push(this.buffer[physicalIndex]);
      }
      return result;
    }
  }

  getTotalLinesWritten(): number {
    return this.totalLinesWritten;
  }

  clear(): void {
    this.buffer = [];
    this.totalLinesWritten = 0;
    this.startIndex = 0;
  }
}

interface ProcessInfo {
  id: number;
  command: string;
  child: ChildProcess | null;
  pid: number | undefined;
  startTime: number;
  exitCode: number | null;
  exitTime: number | null;
  status: "running" | "exited";
  stdoutBuffer: CircularBuffer;
  stderrBuffer: CircularBuffer;
  lastReadStdoutLine: number;
  lastReadStderrLine: number;
}

interface BackgroundProcessServiceState {
  processes: Map<number, ProcessInfo>;
  nextId: number;
  maxProcesses: number;
}

export class BackgroundProcessService extends BaseService<BackgroundProcessServiceState> {
  constructor() {
    super("backgroundProcesses", {
      processes: new Map(),
      nextId: 1,
      maxProcesses: 10,
    });
  }

  async doInitialize(): Promise<BackgroundProcessServiceState> {
    return {
      processes: new Map(),
      nextId: 1,
      maxProcesses: 10,
    };
  }

  async startProcess(
    command: string,
    cwd: string,
  ): Promise<{ id: number; message: string }> {
    // Check if we've hit the process limit
    const runningCount = Array.from(
      this.currentState.processes.values(),
    ).filter((p) => p.status === "running").length;

    if (runningCount >= this.currentState.maxProcesses) {
      return {
        id: -1,
        message: `Error: Maximum background processes (${this.currentState.maxProcesses}) reached. Use KillProcess to terminate a process first. Use ListProcesses to see running processes.`,
      };
    }

    // Allocate process ID
    const id = this.currentState.nextId;
    this.setState({
      ...this.currentState,
      nextId: this.currentState.nextId + 1,
    });

    // Spawn the process
    const { shell, args } = getShellCommand(command);
    const child = spawn(shell, args, { cwd });

    const processInfo: ProcessInfo = {
      id,
      command,
      child,
      pid: child.pid,
      startTime: Date.now(),
      exitCode: null,
      exitTime: null,
      status: "running",
      stdoutBuffer: new CircularBuffer(),
      stderrBuffer: new CircularBuffer(),
      lastReadStdoutLine: 0,
      lastReadStderrLine: 0,
    };

    // Set up output capture
    child.stdout?.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line) {
          processInfo.stdoutBuffer.append(line);
        }
      }
    });

    child.stderr?.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line) {
          processInfo.stderrBuffer.append(line);
        }
      }
    });

    // Handle process exit
    child.on("close", (code) => {
      processInfo.exitCode = code;
      processInfo.exitTime = Date.now();
      processInfo.status = "exited";
      processInfo.child = null;

      logger.debug(`Background process ${id} exited with code ${code}`);

      // Update state
      const updatedProcesses = new Map(this.currentState.processes);
      updatedProcesses.set(id, processInfo);
      this.setState({
        ...this.currentState,
        processes: updatedProcesses,
      });

      // Emit event
      this.emit("processExited", { id, exitCode: code });
    });

    child.on("error", (error) => {
      logger.debug(`Background process ${id} error: ${error.message}`);
      processInfo.stderrBuffer.append(`Process error: ${error.message}`);
    });

    // Add to registry
    const updatedProcesses = new Map(this.currentState.processes);
    updatedProcesses.set(id, processInfo);
    this.setState({
      ...this.currentState,
      processes: updatedProcesses,
    });

    return {
      id,
      message: `Background process started with ID ${id} (PID: ${child.pid}). Use BashOutput to monitor output:\n  BashOutput(bash_id: ${id})`,
    };
  }

  getProcess(id: number): ProcessInfo | undefined {
    return this.currentState.processes.get(id);
  }

  async killProcess(
    id: number,
  ): Promise<{ success: boolean; message: string }> {
    const processInfo = this.currentState.processes.get(id);

    if (!processInfo) {
      return {
        success: false,
        message: `Error: No background process found with ID ${id}. Use ListProcesses to see running processes.`,
      };
    }

    if (processInfo.status === "exited") {
      return {
        success: false,
        message: `Process ${id} has already exited with code ${processInfo.exitCode}.`,
      };
    }

    if (processInfo.child) {
      try {
        processInfo.child.kill();
        return {
          success: true,
          message: `Process ${id} (PID: ${processInfo.pid}) terminated successfully.`,
        };
      } catch (error) {
        return {
          success: false,
          message: `Error killing process ${id}: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    } else {
      return {
        success: false,
        message: `Process ${id} has no child process handle available.`,
      };
    }
  }

  listProcesses(): ProcessInfo[] {
    return Array.from(this.currentState.processes.values()).sort(
      (a, b) => a.id - b.id,
    );
  }

  readOutput(id: number): {
    stdout: string[];
    stderr: string[];
    currentStdoutLine: number;
    currentStderrLine: number;
    status: "running" | "exited";
    exitCode: number | null;
  } | null {
    const processInfo = this.currentState.processes.get(id);

    if (!processInfo) {
      return null;
    }

    // Get new lines since last read
    const stdout = processInfo.stdoutBuffer.getLines(
      processInfo.lastReadStdoutLine,
    );
    const stderr = processInfo.stderrBuffer.getLines(
      processInfo.lastReadStderrLine,
    );

    // Update last read positions
    const updatedProcessInfo = {
      ...processInfo,
      lastReadStdoutLine: processInfo.stdoutBuffer.getTotalLinesWritten(),
      lastReadStderrLine: processInfo.stderrBuffer.getTotalLinesWritten(),
    };

    const updatedProcesses = new Map(this.currentState.processes);
    updatedProcesses.set(id, updatedProcessInfo);
    this.setState({
      ...this.currentState,
      processes: updatedProcesses,
    });

    return {
      stdout,
      stderr,
      currentStdoutLine: updatedProcessInfo.lastReadStdoutLine,
      currentStderrLine: updatedProcessInfo.lastReadStderrLine,
      status: processInfo.status,
      exitCode: processInfo.exitCode,
    };
  }

  async cleanup(): Promise<void> {
    logger.debug("Cleaning up background processes");

    const processes = Array.from(this.currentState.processes.values()).filter(
      (p) => p.status === "running",
    );

    for (const proc of processes) {
      try {
        if (proc.child) {
          proc.child.kill();
          logger.debug(`Killed background process ${proc.id}`);
        }
      } catch (err) {
        logger.debug(`Failed to kill process ${proc.id}:`, err);
      }
    }

    await super.cleanup();
  }
}
