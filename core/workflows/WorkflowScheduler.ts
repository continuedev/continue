/**
 * Workflow Scheduler Service
 *
 * Manages scheduled execution of workflows based on cron expressions.
 * Handles scheduling, unscheduling, and execution triggering.
 */

import * as cronParser from 'cron-parser';
import {
  Workflow,
  WorkflowExecution,
  ExecutionResult,
  ExecutionStatus,
  ExecutionLog,
} from './types';
import { E2BSandboxManager } from './E2BSandboxManager';
import { v4 as uuidv4 } from 'uuid';

interface ScheduledJob {
  workflowId: string;
  cronExpression: string;
  nextRun: Date;
  enabled: boolean;
}

export class WorkflowScheduler {
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private executionQueue: WorkflowExecution[] = [];
  private sandboxManager: E2BSandboxManager;
  private isRunning: boolean = false;
  private pollInterval: number = 60000; // 1 minute

  constructor(sandboxManager: E2BSandboxManager) {
    this.sandboxManager = sandboxManager;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('[WorkflowScheduler] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[WorkflowScheduler] Starting workflow scheduler...');

    // Start the main loop
    this.scheduleLoop();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.isRunning = false;
    console.log('[WorkflowScheduler] Stopped workflow scheduler');
  }

  /**
   * Schedule a workflow
   */
  async scheduleWorkflow(workflow: Workflow): Promise<void> {
    if (!workflow.cronExpression) {
      throw new Error('Workflow must have a cron expression to be scheduled');
    }

    const job: ScheduledJob = {
      workflowId: workflow.id,
      cronExpression: workflow.cronExpression,
      nextRun: this.calculateNextRun(workflow.cronExpression),
      enabled: workflow.enabled,
    };

    this.scheduledJobs.set(workflow.id, job);

    console.log(
      `[WorkflowScheduler] Scheduled workflow ${workflow.id} - Next run: ${job.nextRun.toISOString()}`
    );
  }

  /**
   * Unschedule a workflow
   */
  async unscheduleWorkflow(workflowId: string): Promise<void> {
    if (!this.scheduledJobs.has(workflowId)) {
      throw new Error(`Workflow ${workflowId} is not scheduled`);
    }

    this.scheduledJobs.delete(workflowId);
    console.log(`[WorkflowScheduler] Unscheduled workflow ${workflowId}`);
  }

  /**
   * Update workflow schedule
   */
  async updateSchedule(workflowId: string, cronExpression: string): Promise<void> {
    const job = this.scheduledJobs.get(workflowId);

    if (!job) {
      throw new Error(`Workflow ${workflowId} is not scheduled`);
    }

    job.cronExpression = cronExpression;
    job.nextRun = this.calculateNextRun(cronExpression);

    console.log(
      `[WorkflowScheduler] Updated schedule for workflow ${workflowId} - Next run: ${job.nextRun.toISOString()}`
    );
  }

  /**
   * Get next execution time for a workflow
   */
  getNextExecution(workflowId: string): Date | null {
    const job = this.scheduledJobs.get(workflowId);
    return job?.nextRun || null;
  }

  /**
   * Enable/disable a workflow
   */
  async setWorkflowEnabled(workflowId: string, enabled: boolean): Promise<void> {
    const job = this.scheduledJobs.get(workflowId);

    if (!job) {
      throw new Error(`Workflow ${workflowId} is not scheduled`);
    }

    job.enabled = enabled;
    console.log(`[WorkflowScheduler] Workflow ${workflowId} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Main scheduling loop
   */
  private async scheduleLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.checkSchedules();
        await this.sleep(this.pollInterval);
      } catch (error: any) {
        console.error('[WorkflowScheduler] Error in schedule loop:', error);
        await this.sleep(this.pollInterval);
      }
    }
  }

  /**
   * Check all schedules and trigger due workflows
   */
  private async checkSchedules(): Promise<void> {
    const now = new Date();

    for (const [workflowId, job] of this.scheduledJobs) {
      if (!job.enabled) {
        continue;
      }

      if (now >= job.nextRun) {
        console.log(`[WorkflowScheduler] Triggering workflow ${workflowId}`);

        try {
          // Trigger execution (async - don't wait)
          this.triggerExecution(workflowId).catch(error => {
            console.error(`[WorkflowScheduler] Failed to trigger workflow ${workflowId}:`, error);
          });

          // Update next run time
          job.nextRun = this.calculateNextRun(job.cronExpression);
          console.log(
            `[WorkflowScheduler] Next run for ${workflowId}: ${job.nextRun.toISOString()}`
          );
        } catch (error: any) {
          console.error(`[WorkflowScheduler] Error triggering workflow ${workflowId}:`, error);
        }
      }
    }
  }

  /**
   * Trigger workflow execution
   */
  private async triggerExecution(workflowId: string): Promise<void> {
    // In production, this would:
    // 1. Load workflow from database
    // 2. Create execution record
    // 3. Queue for execution
    // 4. Execute in E2B sandbox
    // 5. Save results

    console.log(`[WorkflowScheduler] Executing workflow ${workflowId}`);

    // For now, just log
    const executionId = `exec-${uuidv4()}`;
    console.log(`[WorkflowScheduler] Created execution ${executionId} for workflow ${workflowId}`);
  }

  /**
   * Calculate next run time from cron expression using cron-parser
   */
  private calculateNextRun(cronExpression: string, timezone?: string): Date {
    try {
      const options = {
        currentDate: new Date(),
        tz: timezone || 'UTC',
      };

      const interval = cronParser.parseExpression(cronExpression, options);
      return interval.next().toDate();
    } catch (error: any) {
      console.error(`[WorkflowScheduler] Invalid cron expression: ${cronExpression}`, error);
      throw new Error(`Invalid cron expression: ${cronExpression} - ${error.message}`);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get scheduler statistics
   */
  getStats(): {
    scheduledWorkflows: number;
    enabledWorkflows: number;
    queuedExecutions: number;
    isRunning: boolean;
  } {
    const enabled = Array.from(this.scheduledJobs.values()).filter(j => j.enabled).length;

    return {
      scheduledWorkflows: this.scheduledJobs.size,
      enabledWorkflows: enabled,
      queuedExecutions: this.executionQueue.length,
      isRunning: this.isRunning,
    };
  }

  /**
   * Get all scheduled workflows
   */
  getScheduledWorkflows(): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values());
  }

  /**
   * Manual trigger for a workflow
   */
  async manualTrigger(workflowId: string): Promise<string> {
    console.log(`[WorkflowScheduler] Manual trigger for workflow ${workflowId}`);

    const executionId = `exec-${uuidv4()}`;

    // Trigger execution asynchronously
    this.triggerExecution(workflowId).catch(error => {
      console.error(`[WorkflowScheduler] Manual trigger failed for ${workflowId}:`, error);
    });

    return executionId;
  }

  /**
   * Validate cron expression
   */
  validateCronExpression(cronExpression: string): boolean {
    try {
      cronParser.parseExpression(cronExpression);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Pause scheduler temporarily
   */
  pause(): void {
    console.log('[WorkflowScheduler] Pausing scheduler...');
    // In production, set a flag to skip executions but keep loop running
  }

  /**
   * Resume scheduler
   */
  resume(): void {
    console.log('[WorkflowScheduler] Resuming scheduler...');
    // In production, clear the pause flag
  }

  /**
   * Get upcoming executions
   */
  getUpcomingExecutions(limit: number = 10): Array<{
    workflowId: string;
    nextRun: Date;
    cronExpression: string;
  }> {
    const jobs = Array.from(this.scheduledJobs.values())
      .filter(j => j.enabled)
      .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime())
      .slice(0, limit);

    return jobs.map(j => ({
      workflowId: j.workflowId,
      nextRun: j.nextRun,
      cronExpression: j.cronExpression,
    }));
  }
}
