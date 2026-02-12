import { services } from "../services/index.js";

import { Tool } from "./types.js";

export const checkBackgroundJobTool: Tool = {
  name: "CheckBackgroundJob",
  displayName: "Check Background Job",
  description: `Check the status and output of a background job.
Returns the current status, exit code (if finished), and all available output.
If the job is still running, returns partial output with "running" status.`,
  parameters: {
    type: "object",
    required: ["job_id"],
    properties: {
      job_id: {
        type: "string",
        description:
          "The ID of the background job to check (e.g., bg-1-1234567890)",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  run: async ({ job_id }: { job_id: string }): Promise<string> => {
    const job = services.backgroundJobs.getJob(job_id);

    if (!job) {
      return JSON.stringify({
        error: `Job ${job_id} not found`,
        available_jobs: services.backgroundJobs.getAllJobs().map((j) => ({
          id: j.id,
          status: j.status,
          command:
            j.command.substring(0, 50) + (j.command.length > 50 ? "..." : ""),
        })),
      });
    }

    const result: Record<string, unknown> = {
      job_id: job.id,
      status: job.status,
      command: job.command,
      output: job.output,
      started_at: job.startTime.toISOString(),
    };

    if (job.endTime) {
      result.ended_at = job.endTime.toISOString();
      result.duration_seconds = Math.round(
        (job.endTime.getTime() - job.startTime.getTime()) / 1000,
      );
    }

    if (job.exitCode !== null) {
      result.exit_code = job.exitCode;
    }

    if (job.error) {
      result.error = job.error;
    }

    return JSON.stringify(result, null, 2);
  },
};
