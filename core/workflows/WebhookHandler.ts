/**
 * Webhook Handler Service
 *
 * Receives webhook events and triggers workflows.
 * Handles webhook registration, signature verification, and event routing.
 */

import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  Workflow,
  WebhookConfig,
} from './types';

export interface WebhookEvent {
  webhookId: string;
  workflowId: string;
  payload: any;
  headers: Record<string, string>;
  timestamp: Date;
  verified: boolean;
}

export class WebhookHandler {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private workflowWebhooks: Map<string, string> = new Map(); // workflowId -> webhookId

  /**
   * Register webhook endpoint for a workflow
   */
  async registerWebhook(workflow: Workflow): Promise<WebhookConfig> {
    if (workflow.triggerType !== 'webhook') {
      throw new Error('Workflow must have webhook trigger type');
    }

    if (!workflow.webhookSecret) {
      throw new Error('Workflow must have a webhook secret');
    }

    const webhookId = `webhook-${uuidv4()}`;
    const webhookUrl = this.generateWebhookUrl(webhookId);

    const config: WebhookConfig = {
      webhookId,
      url: webhookUrl,
      secret: workflow.webhookSecret,
      events: ['*'], // Accept all events by default
    };

    this.webhooks.set(webhookId, config);
    this.workflowWebhooks.set(workflow.id, webhookId);

    console.log(`[WebhookHandler] Registered webhook for workflow ${workflow.id}: ${webhookUrl}`);

    return config;
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(
    webhookId: string,
    payload: any,
    headers: Record<string, string>
  ): Promise<void> {
    console.log(`[WebhookHandler] Received webhook: ${webhookId}`);

    const webhook = this.webhooks.get(webhookId);

    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    // Verify signature
    const signature = headers['x-webhook-signature'] || headers['x-hub-signature-256'];
    const verified = this.verifySignature(payload, signature, webhook.secret);

    if (!verified) {
      console.error(`[WebhookHandler] Webhook signature verification failed for ${webhookId}`);
      throw new Error('Webhook signature verification failed');
    }

    // Find workflow for this webhook
    const workflowId = this.getWorkflowIdByWebhook(webhookId);

    if (!workflowId) {
      throw new Error(`No workflow found for webhook ${webhookId}`);
    }

    // Create webhook event
    const event: WebhookEvent = {
      webhookId,
      workflowId,
      payload,
      headers,
      timestamp: new Date(),
      verified,
    };

    // Trigger workflow execution
    await this.triggerWorkflow(event);
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: any, signature: string | undefined, secret: string): boolean {
    if (!signature) {
      console.warn('[WebhookHandler] No signature provided');
      return false;
    }

    try {
      // Convert payload to string
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

      // GitHub-style signature (sha256)
      if (signature.startsWith('sha256=')) {
        const expectedSignature = 'sha256=' + crypto
          .createHmac('sha256', secret)
          .update(payloadString)
          .digest('hex');

        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        );
      }

      // Simple HMAC signature
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

    } catch (error: any) {
      console.error('[WebhookHandler] Signature verification error:', error);
      return false;
    }
  }

  /**
   * Deregister webhook
   */
  async deregisterWebhook(webhookId: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);

    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    // Remove from maps
    this.webhooks.delete(webhookId);

    // Remove from workflow mapping
    for (const [workflowId, wid] of this.workflowWebhooks) {
      if (wid === webhookId) {
        this.workflowWebhooks.delete(workflowId);
        break;
      }
    }

    console.log(`[WebhookHandler] Deregistered webhook ${webhookId}`);
  }

  /**
   * Get webhook configuration by ID
   */
  getWebhook(webhookId: string): WebhookConfig | null {
    return this.webhooks.get(webhookId) || null;
  }

  /**
   * Get webhook ID for a workflow
   */
  getWebhookByWorkflow(workflowId: string): WebhookConfig | null {
    const webhookId = this.workflowWebhooks.get(workflowId);

    if (!webhookId) {
      return null;
    }

    return this.getWebhook(webhookId);
  }

  /**
   * Get workflow ID by webhook ID
   */
  private getWorkflowIdByWebhook(webhookId: string): string | null {
    for (const [workflowId, wid] of this.workflowWebhooks) {
      if (wid === webhookId) {
        return workflowId;
      }
    }
    return null;
  }

  /**
   * Generate webhook URL
   */
  private generateWebhookUrl(webhookId: string): string {
    const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://api.codemode.dev';
    return `${baseUrl}/webhooks/${webhookId}`;
  }

  /**
   * Trigger workflow from webhook event
   */
  private async triggerWorkflow(event: WebhookEvent): Promise<void> {
    console.log(`[WebhookHandler] Triggering workflow ${event.workflowId} from webhook`);

    // In production, this would:
    // 1. Load workflow from database
    // 2. Create execution record with webhook payload
    // 3. Queue for execution
    // 4. Execute in E2B sandbox
    // 5. Save results

    console.log(`[WebhookHandler] Workflow ${event.workflowId} triggered successfully`);
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(webhookId: string, updates: Partial<WebhookConfig>): Promise<void> {
    const webhook = this.webhooks.get(webhookId);

    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    // Update webhook config
    Object.assign(webhook, updates);

    console.log(`[WebhookHandler] Updated webhook ${webhookId}`);
  }

  /**
   * Test webhook
   */
  async testWebhook(webhookId: string, testPayload?: any): Promise<boolean> {
    const webhook = this.webhooks.get(webhookId);

    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const payload = testPayload || { test: true, timestamp: new Date().toISOString() };

    // Generate test signature
    const signature = 'sha256=' + crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    try {
      await this.handleWebhook(webhookId, payload, {
        'x-webhook-signature': signature,
        'content-type': 'application/json',
      });

      return true;
    } catch (error: any) {
      console.error('[WebhookHandler] Test webhook failed:', error);
      return false;
    }
  }

  /**
   * Get all webhooks
   */
  getAllWebhooks(): WebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Get webhook statistics
   */
  getStats(): {
    totalWebhooks: number;
    activeWebhooks: number;
  } {
    return {
      totalWebhooks: this.webhooks.size,
      activeWebhooks: this.webhooks.size, // All registered webhooks are active
    };
  }

  /**
   * Validate webhook payload against schema
   */
  validatePayload(payload: any, schema?: any): boolean {
    if (!schema) {
      // If no schema provided, accept any valid JSON
      return typeof payload === 'object';
    }

    // In production, use a JSON schema validator
    // For now, basic validation
    return typeof payload === 'object';
  }

  /**
   * Extract event type from payload
   */
  extractEventType(payload: any): string {
    // GitHub-style event detection
    if (payload.action) {
      return payload.action;
    }

    // Generic event type
    if (payload.event) {
      return payload.event;
    }

    // Default
    return 'webhook';
  }

  /**
   * Filter webhook events
   */
  shouldProcessEvent(webhook: WebhookConfig, eventType: string): boolean {
    // If events list contains '*', accept all events
    if (webhook.events.includes('*')) {
      return true;
    }

    // Otherwise, check if event type is in the list
    return webhook.events.includes(eventType);
  }

  /**
   * Generate webhook secret
   */
  static generateSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Rotate webhook secret
   */
  async rotateSecret(webhookId: string): Promise<string> {
    const webhook = this.webhooks.get(webhookId);

    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const newSecret = WebhookHandler.generateSecret();
    webhook.secret = newSecret;

    console.log(`[WebhookHandler] Rotated secret for webhook ${webhookId}`);

    return newSecret;
  }
}
