import { ChildProcess, spawn } from "child_process";
import { EventEmitter } from "events";

import { logger } from "../util/logger.js";

export type BackgroundJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface BackgroundJob {
  id: string;
  status: BackgroundJobStatus;
  command: string;
  output: string;
  exitCode: number | null;
  startTime: Date;
  endTime: Date | null;
  lastOutputAt: Date | null;
  stalledAt: Date | null;
  error?: string;
}

export interface BackgroundJobChangeEvent {
  job: BackgroundJob;
  previousJob?: BackgroundJob;
  reason:
    | "created"
    | "started"
    | "completed"
    | "failed"
    | "cancelled"
    | "stalled";
}

const MAX_CONCURRENT_JOBS = 5;
const MAX_OUTPUT_LINES = 1000;
const STALL_CHECK_INTERVAL_MS = 5000;
const STALL_TIMEOUT_MS = 60000;

/**
 * Service for managing background job execution and lifecycle
 * Handles spawning, tracking, and cleanup of background processes
 */
export class BackgroundJobService extends EventEmitter {
  private jobs: Map<string, BackgroundJob> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private jobCounter = 0;
  private stallCheckInterval: NodeJS.Timeout;

  constructor() {
    super();
    this.stallCheckInterval = setInterval(() => {
      this.checkForStalledJobs();
    }, STALL_CHECK_INTERVAL_MS);
    this.stallCheckInterval.unref?.();
  }

  private cloneJob(job: BackgroundJob): BackgroundJob {
    return {
      ...job,
      startTime: new Date(job.startTime),
      endTime: job.endTime ? new Date(job.endTime) : null,
    };
  }

  private emitJobChanged(
    job: BackgroundJob,
    reason: BackgroundJobChangeEvent["reason"],
    previousJob?: BackgroundJob,
  ): void {
    this.emit("jobChanged", {
      job: this.cloneJob(job),
      previousJob: previousJob ? this.cloneJob(previousJob) : undefined,
      reason,
    } satisfies BackgroundJobChangeEvent);
  }

  private checkForStalledJobs(): void {
    const now = Date.now();
    for (const job of this.jobs.values()) {
      if (job.status !== "running" || job.stalledAt) {
        continue;
      }

      const lastActiveAt =
        job.lastOutputAt?.getTime() ?? job.startTime.getTime();
      if (now - lastActiveAt < STALL_TIMEOUT_MS) {
        continue;
      }

      const previousJob = this.cloneJob(job);
      job.stalledAt = new Date(now);
      this.emitJobChanged(job, "stalled", previousJob);
    }
  }

  cleanup(): void {
    clearInterval(this.stallCheckInterval);
    this.removeAllListeners();
  }

  createJob(command: string): BackgroundJob | null {
    const runningCount = this.getRunningJobCount();
    if (runningCount >= MAX_CONCURRENT_JOBS) {
      logger.warn(
        `Cannot create background job: limit of ${MAX_CONCURRENT_JOBS} reached`,
      );
      return null;
    }

    const id = `bg-${++this.jobCounter}-${Date.now()}`;
    const job: BackgroundJob = {
      id,
      status: "pending",
      command,
      output: "",
      exitCode: null,
      startTime: new Date(),
      endTime: null,
      lastOutputAt: null,
      stalledAt: null,
    };

    this.jobs.set(id, job);
    this.emitJobChanged(job, "created");
    return job;
  }

  startJob(jobId: string, shell: string, args: string[]): ChildProcess | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.error(`Cannot start job ${jobId}: job not found`);
      return null;
    }

    const previousJob = this.cloneJob(job);
    job.status = "running";
    job.stalledAt = null;
    this.emitJobChanged(job, "started", previousJob);

    const child = spawn(shell, args, { stdio: "pipe" });
    this.processes.set(jobId, child);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (data: string) => {
      this.appendOutput(jobId, data);
    });

    child.stderr?.on("data", (data: string) => {
      this.appendOutput(jobId, data);
    });

    child.on("close", (code: number | null) => {
      this.completeJob(jobId, code ?? 0);
    });

    child.on("error", (error: Error) => {
      this.failJob(jobId, error.message);
    });

    return child;
  }

  createJobWithProcess(
    command: string,
    child: ChildProcess,
    existingOutput: string = "",
  ): BackgroundJob | null {
    const runningCount = this.getRunningJobCount();
    if (runningCount >= MAX_CONCURRENT_JOBS) {
      logger.warn(
        `Cannot create background job: limit of ${MAX_CONCURRENT_JOBS} reached`,
      );
      return null;
    }

    const id = `bg-${++this.jobCounter}-${Date.now()}`;
    const job: BackgroundJob = {
      id,
      status: "running",
      command,
      output: existingOutput,
      exitCode: null,
      startTime: new Date(),
      endTime: null,
      lastOutputAt: existingOutput ? new Date() : null,
      stalledAt: null,
    };

    this.jobs.set(id, job);
    this.processes.set(id, child);
    this.emitJobChanged(job, "started");

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (data: string) => {
      this.appendOutput(id, data);
    });

    child.stderr?.on("data", (data: string) => {
      this.appendOutput(id, data);
    });

    child.on("close", (code: number | null) => {
      this.completeJob(id, code ?? 0);
    });

    child.on("error", (error: Error) => {
      this.failJob(id, error.message);
    });

    return job;
  }

  // todo: improve write efficiency with ring buffer or similar
  appendOutput(jobId: string, data: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.output += data;
      job.lastOutputAt = new Date();
      job.stalledAt = null;
      const lines = job.output.split("\n");
      if (lines.length > MAX_OUTPUT_LINES) {
        job.output = lines.slice(-MAX_OUTPUT_LINES).join("\n");
      }
    }
  }

  completeJob(jobId: string, exitCode: number): void {
    const job = this.jobs.get(jobId);
    if (job) {
      if (job.status === "cancelled") {
        return;
      }
      const previousJob = this.cloneJob(job);
      job.status = exitCode === 0 ? "completed" : "failed";
      job.exitCode = exitCode;
      job.endTime = new Date();
      job.stalledAt = null;
      this.processes.delete(jobId);
      this.emitJobChanged(job, "completed", previousJob);
    }
  }

  failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      const previousJob = this.cloneJob(job);
      job.status = "failed";
      job.error = error;
      job.endTime = new Date();
      job.stalledAt = null;
      this.processes.delete(jobId);
      this.emitJobChanged(job, "failed", previousJob);
    }
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    const process = this.processes.get(jobId);

    if (!job) return false;

    if (process) {
      process.kill();
      this.processes.delete(jobId);
    }

    const previousJob = this.cloneJob(job);
    job.status = "cancelled";
    job.endTime = new Date();
    job.stalledAt = null;
    this.emitJobChanged(job, "cancelled", previousJob);
    return true;
  }

  getJob(jobId: string): BackgroundJob | undefined {
    return this.jobs.get(jobId);
  }

  getRunningJobs(): BackgroundJob[] {
    return Array.from(this.jobs.values()).filter(
      (job) => job.status === "running" || job.status === "pending",
    );
  }

  getAllJobs(): BackgroundJob[] {
    return Array.from(this.jobs.values());
  }

  getRunningJobCount(): number {
    return this.getRunningJobs().length;
  }

  killAllJobs(): void {
    for (const [jobId, process] of this.processes) {
      process.kill();
      const job = this.jobs.get(jobId);
      if (job) {
        const previousJob = this.cloneJob(job);
        job.status = "cancelled";
        job.endTime = new Date();
        job.stalledAt = null;
        this.emitJobChanged(job, "cancelled", previousJob);
      }
    }
    this.processes.clear();
  }
}

export const backgroundJobService = new BackgroundJobService();
