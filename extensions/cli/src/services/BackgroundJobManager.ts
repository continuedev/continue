import { ChildProcess, spawn } from "child_process";

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
  error?: string;
}

const MAX_CONCURRENT_JOBS = 5;
const MAX_OUTPUT_LINES = 1000;

export class BackgroundJobManager {
  private jobs: Map<string, BackgroundJob> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private jobCounter = 0;

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
    };

    this.jobs.set(id, job);
    return job;
  }

  startJob(jobId: string, shell: string, args: string[]): ChildProcess | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.error(`Cannot start job ${jobId}: job not found`);
      return null;
    }

    job.status = "running";

    const child = spawn(shell, args, { stdio: "pipe" });
    this.processes.set(jobId, child);

    child.stdout?.on("data", (data: Buffer) => {
      this.appendOutput(jobId, data.toString());
    });

    child.stderr?.on("data", (data: Buffer) => {
      this.appendOutput(jobId, data.toString());
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
    };

    this.jobs.set(id, job);
    this.processes.set(id, child);

    child.stdout?.on("data", (data: Buffer) => {
      this.appendOutput(id, data.toString());
    });

    child.stderr?.on("data", (data: Buffer) => {
      this.appendOutput(id, data.toString());
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
      const lines = job.output.split("\n");
      if (lines.length > MAX_OUTPUT_LINES) {
        job.output = lines.slice(-MAX_OUTPUT_LINES).join("\n");
      }
    }
  }

  completeJob(jobId: string, exitCode: number): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = exitCode === 0 ? "completed" : "failed";
      job.exitCode = exitCode;
      job.endTime = new Date();
      this.processes.delete(jobId);
    }
  }

  failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = "failed";
      job.error = error;
      job.endTime = new Date();
      this.processes.delete(jobId);
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

    job.status = "cancelled";
    job.endTime = new Date();
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
        job.status = "cancelled";
        job.endTime = new Date();
      }
    }
    this.processes.clear();
  }

  reset(): void {
    this.killAllJobs();
    this.jobs.clear();
    this.jobCounter = 0;
  }
}

export const backgroundJobManager = new BackgroundJobManager();
