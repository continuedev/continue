import { createServer, Server, IncomingMessage, ServerResponse } from "http";

// Define Message type locally since it's not exported from elsewhere
interface Message {
  role: "user" | "assistant";
  content: string;
  messageType: "chat";
}

export interface MockServerState {
  messages: Message[];
  isResponding: boolean;
  responseText: string;
  responseInProgress: boolean;
}

export class MockRemoteServer {
  private server: Server | null = null;
  private state: MockServerState = {
    messages: [],
    isResponding: false,
    responseText: "",
    responseInProgress: false,
  };
  private onMessageCallbacks: Array<(message: string) => void> = [];
  private pendingTimeouts: Set<NodeJS.Timeout> = new Set();

  constructor() {}

  private handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = req.url || "";
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url === "/state" && req.method === "GET") {
      // GET /state - returns current chat state
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(this.state));
    } else if (url === "/message" && req.method === "POST") {
      // POST /message - sends a message to the assistant
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const { message, interrupt } = JSON.parse(body);

          if (interrupt || message === "") {
            // Handle interrupt
            this.state.isResponding = false;
            this.state.responseInProgress = false;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
          }

          // Add user message
          this.state.messages.push({
            role: "user",
            content: message,
            messageType: "chat",
          });

          // Start simulated response
          this.state.isResponding = true;
          this.state.responseInProgress = true;
          this.state.responseText = "";

          // Add assistant message placeholder
          this.state.messages.push({
            role: "assistant",
            content: "",
            messageType: "chat",
          });
          
          // Notify callbacks after state is set up
          const timeout = setTimeout(() => {
            this.onMessageCallbacks.forEach(cb => cb(message));
            this.pendingTimeouts.delete(timeout);
          }, 10);
          this.pendingTimeouts.add(timeout);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  async start(port: number = 0): Promise<number> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(port, () => {
        const address = this.server!.address();
        const actualPort = typeof address === "object" && address !== null ? address.port : port;
        resolve(actualPort);
      });
    });
  }

  async stop(): Promise<void> {
    // Clear any ongoing streaming
    this.state.isResponding = false;
    this.state.responseInProgress = false;
    
    // Clear any streaming intervals
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }
    
    // Clear any pending timeouts
    this.pendingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.pendingTimeouts.clear();
    
    // Clear callbacks to prevent memory leaks
    this.onMessageCallbacks = [];
    
    return new Promise((resolve) => {
      if (this.server) {
        // Force close all connections
        this.server.closeAllConnections();
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Test helper methods
  private streamInterval: NodeJS.Timeout | null = null;
  
  simulateResponse(text: string, streaming: boolean = false) {
    if (!this.state.isResponding) return;

    if (streaming) {
      // Clear any existing streaming
      if (this.streamInterval) {
        clearInterval(this.streamInterval);
      }
      
      // Simulate streaming response
      let index = 0;
      this.streamInterval = setInterval(() => {
        if (!this.state.isResponding) {
          // Interrupt detected
          clearInterval(this.streamInterval!);
          this.streamInterval = null;
          return;
        }
        
        if (index < text.length) {
          this.state.responseText += text[index];
          // Update the last assistant message
          const lastMessage = this.state.messages[this.state.messages.length - 1];
          if (lastMessage && lastMessage.role === "assistant") {
            lastMessage.content = this.state.responseText;
          }
          index++;
        } else {
          clearInterval(this.streamInterval!);
          this.streamInterval = null;
          this.state.isResponding = false;
          this.state.responseInProgress = false;
        }
      }, 10); // Stream one character every 10ms
    } else {
      // Instant response
      this.state.responseText = text;
      const lastMessage = this.state.messages[this.state.messages.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        lastMessage.content = text;
      }
      this.state.isResponding = false;
      this.state.responseInProgress = false;
    }
  }

  onMessage(callback: (message: string) => void) {
    this.onMessageCallbacks.push(callback);
  }

  getState(): MockServerState {
    return { ...this.state };
  }

  reset() {
    // Clear any intervals/timeouts before resetting
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }
    this.pendingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.pendingTimeouts.clear();
    
    this.state = {
      messages: [],
      isResponding: false,
      responseText: "",
      responseInProgress: false,
    };
    this.onMessageCallbacks = [];
  }

  getUrl(port: number): string {
    return `http://localhost:${port}`;
  }
}

// Add a dummy test to satisfy Jest requirement
describe("MockRemoteServer", () => {
  test("should be defined", () => {
    expect(MockRemoteServer).toBeDefined();
  });
});