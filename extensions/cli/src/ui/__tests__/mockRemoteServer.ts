import { Server } from "http";

import express from "express";
import { describe, expect, test } from "vitest";

import { DisplayMessage } from "../types.js";

export interface MockRemoteServerConfig {
  port?: number;
  responses?: string[];
}

export class MockRemoteServer {
  private server: Server | null = null;
  private app: express.Application;
  private messages: DisplayMessage[] = [];
  private responses: string[] = [];
  private currentResponseIndex = 0;
  private isProcessing = false;
  private streamInterval: NodeJS.Timeout | null = null;

  constructor(config: MockRemoteServerConfig = {}) {
    this.app = express();
    this.app.use(express.json());
    this.responses = config.responses || ["Mock response"];
    this.setupRoutes();
  }

  private setupRoutes() {
    // GET /state - Return the current state
    this.app.get("/state", (req, res) => {
      res.json({
        chatHistory: this.messages,
        isProcessing: this.isProcessing,
        messageQueueLength: 0,
      });
    });

    // POST /message - Handle new messages
    this.app.post("/message", (req, res) => {
      const { message } = req.body;

      if (!message && message !== "") {
        return res.status(400).json({ error: "Message field is required" });
      }

      // Add user message
      if (message) {
        this.messages.push({
          role: "user",
          content: message,
        });
      }

      // Start processing response
      this.processResponse();

      res.json({
        queued: true,
        position: 1,
        willInterrupt: false,
      });
    });

    // POST /exit - Shutdown server
    this.app.post("/exit", (req, res) => {
      res.json({
        message: "Server shutting down",
        success: true,
      });

      this.stop();
    });
  }

  private processResponse() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    // Get the response to simulate
    const response =
      this.responses[this.currentResponseIndex % this.responses.length];
    this.currentResponseIndex++;

    // Simulate streaming response
    let currentContent = "";
    let charIndex = 0;

    // Add initial streaming message
    const streamingMessage: DisplayMessage = {
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    this.messages.push(streamingMessage);

    // Simulate character-by-character streaming (but faster for tests)
    this.streamInterval = setInterval(() => {
      if (charIndex < response.length) {
        currentContent += response[charIndex];
        streamingMessage.content = currentContent;
        charIndex++;
      } else {
        // Finish streaming
        streamingMessage.isStreaming = false;
        this.isProcessing = false;

        if (this.streamInterval) {
          clearInterval(this.streamInterval);
          this.streamInterval = null;
        }
      }
    }, 10); // Fast streaming for tests
  }

  public async start(port: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          const actualPort = (this.server!.address() as any)?.port || port;
          resolve(actualPort);
        }
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.streamInterval) {
        clearInterval(this.streamInterval);
        this.streamInterval = null;
      }

      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getMessages(): DisplayMessage[] {
    return [...this.messages];
  }

  public clearMessages(): void {
    this.messages = [];
  }

  public setResponses(responses: string[]): void {
    this.responses = responses;
    this.currentResponseIndex = 0;
  }
}

// Add a dummy test to satisfy Vitest requirement
describe("MockRemoteServer", () => {
  test("should be defined", () => {
    expect(MockRemoteServer).toBeDefined();
  });
});
