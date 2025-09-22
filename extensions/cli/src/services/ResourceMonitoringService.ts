import { exec } from "child_process";
import * as os from "os";
import { promisify } from "util";

import { logger } from "../util/logger.js";

const execAsync = promisify(exec);

export interface ResourceUsage {
  timestamp: number;
  memory: {
    rss: number; // Resident Set Size
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    user: number;
    system: number;
    percent?: number; // CPU percentage (calculated)
  };
  system: {
    loadAverage: number[];
    uptime: number;
    freeMemory: number;
    totalMemory: number;
  };
  eventLoop: {
    lag: number;
  };
  fileDescriptors?: number;
}

export interface ResourceMonitoringState {
  isMonitoring: boolean;
  resourceHistory: ResourceUsage[];
}

class ResourceMonitoringService {
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private intervalMs = 1000; // Default 1 second
  private resourceHistory: ResourceUsage[] = [];
  private maxHistorySize = 300; // Keep 5 minutes at 1s intervals
  private lastCpuUsage = process.cpuUsage();
  private lastTimestamp = Date.now();

  async initialize(): Promise<void> {
    // Start monitoring if verbose mode is enabled
    if (process.argv.includes("--verbose")) {
      this.startMonitoring();
    }

    // Cleanup on exit
    process.on("exit", () => this.cleanup());
    process.on("SIGINT", () => this.cleanup());
    process.on("SIGTERM", () => this.cleanup());
  }

  async cleanup(): Promise<void> {
    this.stopMonitoring();
  }

  public startMonitoring(intervalMs = 1000): void {
    if (this.isMonitoring) return;

    this.intervalMs = intervalMs;
    this.isMonitoring = true;
    this.lastCpuUsage = process.cpuUsage();
    this.lastTimestamp = Date.now();

    this.monitoringInterval = setInterval(() => {
      this.collectResourceUsage();
    }, this.intervalMs);

    logger.debug("Resource monitoring started", { intervalMs });
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.debug("Resource monitoring stopped");
  }

  public getCurrentResourceUsage(): ResourceUsage {
    const now = Date.now();
    const currentCpuUsage = process.cpuUsage();
    const timeDiff = now - this.lastTimestamp;

    // Calculate CPU percentage
    const userDiff = currentCpuUsage.user - this.lastCpuUsage.user;
    const systemDiff = currentCpuUsage.system - this.lastCpuUsage.system;
    const totalDiff = userDiff + systemDiff;
    const cpuPercent = timeDiff > 0 ? (totalDiff / (timeDiff * 1000)) * 100 : 0;

    const memoryUsage = process.memoryUsage();

    const usage: ResourceUsage = {
      timestamp: now,
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
      },
      cpu: {
        user: currentCpuUsage.user,
        system: currentCpuUsage.system,
        percent: Math.min(cpuPercent, 100), // Cap at 100%
      },
      system: {
        loadAverage: this.getLoadAverage(),
        uptime: this.getProcessUptime(),
        freeMemory: this.getFreeMemory(),
        totalMemory: this.getTotalMemory(),
      },
      eventLoop: {
        lag: this.measureEventLoopLag(),
      },
    };

    // Try to get file descriptor count (Unix only)
    this.getFileDescriptorCount()
      .then((count) => {
        if (count !== null) {
          usage.fileDescriptors = count;
        }
      })
      .catch(() => {
        // Ignore errors for file descriptor counting
      });

    return usage;
  }

  public getResourceHistory(): ResourceUsage[] {
    return [...this.resourceHistory];
  }

  public getResourceSummary(): {
    current: ResourceUsage;
    peak: {
      memory: number;
      cpu: number;
    };
    average: {
      memory: number;
      cpu: number;
    };
  } {
    const current = this.getCurrentResourceUsage();

    if (this.resourceHistory.length === 0) {
      return {
        current,
        peak: {
          memory: current.memory.rss,
          cpu: current.cpu.percent || 0,
        },
        average: {
          memory: current.memory.rss,
          cpu: current.cpu.percent || 0,
        },
      };
    }

    const peakMemory = Math.max(
      ...this.resourceHistory.map((r) => r.memory.rss),
    );
    const peakCpu = Math.max(
      ...this.resourceHistory.map((r) => r.cpu.percent || 0),
    );

    const avgMemory =
      this.resourceHistory.reduce((sum, r) => sum + r.memory.rss, 0) /
      this.resourceHistory.length;
    const avgCpu =
      this.resourceHistory.reduce((sum, r) => sum + (r.cpu.percent || 0), 0) /
      this.resourceHistory.length;

    return {
      current,
      peak: {
        memory: Math.max(peakMemory, current.memory.rss),
        cpu: Math.max(peakCpu, current.cpu.percent || 0),
      },
      average: {
        memory: avgMemory,
        cpu: avgCpu,
      },
    };
  }

  private collectResourceUsage(): void {
    try {
      const usage = this.getCurrentResourceUsage();

      // Update for next CPU calculation
      this.lastCpuUsage = process.cpuUsage();
      this.lastTimestamp = usage.timestamp;

      // Add to history
      this.resourceHistory.push(usage);

      // Trim history if too large
      if (this.resourceHistory.length > this.maxHistorySize) {
        this.resourceHistory = this.resourceHistory.slice(-this.maxHistorySize);
      }

      // Check for potential issues and log warnings
      this.checkResourceThresholds(usage);
    } catch (error) {
      logger.error("Error collecting resource usage", error);
    }
  }

  private checkResourceThresholds(usage: ResourceUsage): void {
    const memoryUsageMB = usage.memory.rss / 1024 / 1024;
    const cpuPercent = usage.cpu.percent || 0;

    // Memory threshold: 500MB
    if (memoryUsageMB > 500) {
      logger.warn("High memory usage detected", {
        memoryMB: Math.round(memoryUsageMB),
        threshold: 500,
      });
    }

    // CPU threshold: 80%
    if (cpuPercent > 80) {
      logger.warn("High CPU usage detected", {
        cpuPercent: Math.round(cpuPercent),
        threshold: 80,
      });
    }

    // Event loop lag threshold: 100ms
    if (usage.eventLoop.lag > 100) {
      logger.warn("High event loop lag detected", {
        lagMs: Math.round(usage.eventLoop.lag),
        threshold: 100,
      });
    }
  }

  private async getFileDescriptorCount(): Promise<number | null> {
    if (process.platform === "win32") {
      return null; // Not supported on Windows
    }

    try {
      const { stdout } = await execAsync(`lsof -p ${process.pid} | wc -l`);
      return parseInt(stdout.trim(), 10) - 1; // Subtract 1 for header line
    } catch {
      return null;
    }
  }

  private getLoadAverage(): number[] {
    try {
      return process.platform === "win32" ? [0, 0, 0] : os.loadavg();
    } catch {
      return [0, 0, 0];
    }
  }

  private getProcessUptime(): number {
    try {
      return typeof process.uptime === "function" ? process.uptime() : 0;
    } catch {
      return 0;
    }
  }

  private getFreeMemory(): number {
    try {
      return os.freemem();
    } catch {
      return 0;
    }
  }

  private getTotalMemory(): number {
    try {
      return os.totalmem();
    } catch {
      return 1024 * 1024 * 1024; // 1GB default fallback
    }
  }

  // Synchronous approximation of event loop lag
  private measureEventLoopLag(): number {
    // Return a simple approximation based on load average on Unix systems
    const loadAvg = this.getLoadAverage();
    if (loadAvg[0] > 0) {
      // Rough approximation: higher load = higher lag
      return Math.min(loadAvg[0] * 10, 200); // Cap at 200ms
    }

    return 0;
  }
}

export { ResourceMonitoringService };
