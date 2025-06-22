import express from "express";
import path from "path";
import crypto from "crypto";
import bodyParser from "body-parser";
import { Message } from "core/protocol/messenger";
type MessageHandler = (data: any, messageId?: string) => Promise<any>;
export type Handler<T, U> = (message: Message<T>) => Promise<U> | U;

export class NodeGUI {
  private windowId: string;
  private core: any;
  private messageHandler?: (type: string, data: any, messageId?: string) => Promise<any>;
  private handlers: Map<string, MessageHandler> = new Map(); // NEW
  private clients: Set<any> = new Set(); // For SSE clients

  constructor(opts: { windowId: string }) {
    this.windowId = opts.windowId;
    this.setupServer();
  }

  public setMessageHandler(
    handler: (type: string, data: any, messageId?: string) => Promise<any>
  ) {
    this.messageHandler = handler;
  }

  public setCore(core: any) {
    this.core = core;
  }



  /**
* Handle an async iterator response, streaming results via SSE
* @param response The async iterator response
* @param respond Function to send SSE responses
* @param res Express response object
* @returns Promise that resolves when the iterator is complete
*/
  private async handleAsyncIterator(response: any, respond: (message: any) => void, res: any): Promise<any> {
    try {
      let next = await response.next();
      while (!next.done) {
        // Send intermediate results via SSE
        respond({
          done: false,
          content: next.value,
          status: "success"
        });

        next = await response.next();
      }

      // Send final result
      const finalResponse = {
        done: true,
        content: next.value,
        status: "success"
      };

      respond(finalResponse);

      return res.json(finalResponse);

    } catch (e: any) {
      const errorResponse = {
        done: true,
        error: e.message,
        status: "error"
      };
      respond(errorResponse);
      return res.json(errorResponse);
    }
  }

  private setupServer() {
    const app = express();
    const guiDir = path.resolve(__dirname, "../../../gui/dist");
    console.log("Serving assets from:", guiDir);

    app.use("/assets", express.static(path.join(guiDir, "assets")));

    app.use(bodyParser.json({ limit: '50mb' }));

    // Add SSE endpoint for server-to-client communication
    app.get("/events", (req, res) => {
      console.log("Client connected to SSE stream");

      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Send an initial connection message
      res.write("data: {\"connected\":true}\n\n");

      // Add this client to our set
      this.clients.add(res);

      // Remove client when connection closes
      req.on("close", () => {
        console.log("Client disconnected from SSE stream");
        this.clients.delete(res);
      });
    });

    app.get("/", (_req, res) => {
      console.log("GET / called in NodeGUI");

      const nonce = crypto.randomBytes(16).toString("base64");

      const initialPrompt: string = typeof _req.query.prompt === "string"
        ? _req.query.prompt
        : "";

      // turn it into a JS literal we can embed safely
      const initialPromptJS = JSON.stringify(initialPrompt);


      const isNewSession = _req.query.newsession === "true";
      let triggerNewSessionScript = "";
      if (isNewSession) {
        triggerNewSessionScript = `
        if (window.location.search.includes("newsession=true")) {
            // Remove the param immediately to prevent double-trigger on rerender
            const url = new URL(window.location.href);
            url.searchParams.delete('newsession');
            window.history.replaceState({}, document.title, url.toString());

            // Poll for the plus button and click it once found
            let tries = 0;
            const maxTries = 20; // Try for 3 seconds (20 * 150ms)
            const interval = setInterval(() => {
              
              const btnSpan = document.querySelector('[data-testid="block-settings-toolbar-icon-new-session"]');
              if (btnSpan) {
                // Find the inner button (role=button)
                const button = btnSpan.querySelector('[role="button"]');
                if (button) {
                  button.click();
                  clearInterval(interval);
                  console.log("Auto-clicked New Session button because of ?newsession=true");
                  return;
                }
              }
              tries++;
              if (tries > maxTries) {
                clearInterval(interval);
                console.warn("Could not find New Session button to auto-click");
              }
            }, 150);
          }
`;
      }

      const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="/assets/index.css" rel="stylesheet">
          <title>Continue</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="/assets/index.js"></script>
          <script>
            if (!window.vscode) {
                window.vscode = {
                  postMessage: function(msg) {
                    // POST to the Node Server /message and forward response as a 'message' event
                    fetch("/message", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(msg),
                    })
                    .catch(console.error);
                  }
                };
              }
              
            // Add SSE connection for server-to-client communication
            const eventSource = new EventSource('/events');
            eventSource.onmessage = function(event) {
              try {
                const message = JSON.parse(event.data);
                // Dispatch as a window message event to be compatible with existing code
                window.dispatchEvent(new MessageEvent('message', { data: message }));
              } catch (err) {
                console.error('Error processing SSE message:', err);
              }
            };
            eventSource.onerror = function(err) {
              console.error('EventSource error:', err);
              // Try to reconnect after a delay
              setTimeout(() => {
                new EventSource('/events');
              }, 10127);
            };
              
            window.ide = "node-ide";
            window.windowId = "${this.windowId}";
            window.vscMediaUrl = "/assets";
            window.workspacePaths = ${JSON.stringify([process.cwd()])};
            window.isFullScreen = false;


            // Inject prompt into editor if ?prompt=... is provided
            const initialPrompt = ${initialPromptJS};

            if (initialPrompt) {
              const interval = setInterval(() => {
                const inputDiv = document.evaluate("//div[@contenteditable='true' and contains(@class, 'ProseMirror')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (!inputDiv) return;
               
                inputDiv.focus();

                if (inputDiv.innerText.trim() !== initialPrompt.trim()) {
                  inputDiv.innerHTML = "<p>" + initialPrompt + "</p>";
                  inputDiv.dispatchEvent(new Event("input", { bubbles: true }));
                  return;
                }
                 
                // Only dispatch Enter if the innerText is correct and not empty
                if (inputDiv.innerText.trim() === initialPrompt.trim()) {
                  const enterEventOptions = {
                    key: "Enter",
                    code: "Enter",
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                  };
                  inputDiv.dispatchEvent(new KeyboardEvent("keydown", enterEventOptions));
                  inputDiv.dispatchEvent(new KeyboardEvent("keyup", enterEventOptions));
                  clearInterval(interval); // Done!
                }
              }, 150);
            }

            ${triggerNewSessionScript}
          </script>
        </body>
      </html>`;
      res.send(html);
    });

    app.post("/message", async (req: any, res: any) => {
      console.log("POST /message NodeGui", req.body);

      const { messageType, data, messageId } = req.body;
      console.log("Received message:", messageType, data, messageId);

      if (!messageType) {
        return res.status(400).json({
          done: true,
          status: "error",
          error: "Missing 'messageType'",
        });
      }

      // Create a respond function that uses SSE for streaming responses
      const respond = (message: any) => {
        // For streaming responses, send via SSE
        const responseMsg = {
          messageId,
          messageType,
          data: message
        };

        // Send to all connected clients via SSE
        this.clients.forEach(client => {
          try {
            client.write(`data: ${JSON.stringify(responseMsg)}\n\n`);
          } catch (err) {
            console.error("Error sending to client:", err);
            this.clients.delete(client);
          }
        });
      };

      try {
        let handler:
          | ((msg: { data: any; messageId?: string }) => any)
          | undefined;

        if (this.handlers.has(messageType)) {
          handler = this.handlers.get(messageType)!;
        } else if (this.core?.messenger?.externalTypeListeners.has(messageType)) {
          const handler2 = this.core.messenger.externalTypeListeners.get(messageType);
          const result1 = await handler2({ data, messageId });
          return res.json({
            done: true,
            status: "success",
            content: result1,
          });

        }
        // else if (this.messageHandler) {
        //   handler = async ({ data }) =>
        //     await this.messageHandler!(messageType, data, messageId);
        // } else if (this.core?.invoke) {
        //   handler = async ({ data }) => await this.core.invoke(messageType, data);
        // }

        if (!handler) {
          throw new Error(`No handler found for messageType: ${messageType}`);
        }

        const result = await handler({ data, messageId });

        // ✅ Support async generators (e.g. llm/streamChat)
        if (result && typeof result[Symbol.asyncIterator] === "function") {
          return this.handleAsyncIterator(result, respond, res);
        }
        else {
          respond({
            done: true,
            content: result,
            status: "success"
          });
          res.json({
            done: true,
            status: "success",
            content: result,
          });
        }
      } catch (err: any) {
        console.error("Message handling error:", err);
        // respond({
        //   done: true,
        //   content: err.message ?? "Unknown error",
        //   status: "error"
        // });
        res.json({
          done: true,
          status: "error",
          error: err.message ?? "Unknown error",
        });

      }
    });

    const server = app.listen(10127, () => {
      console.log("Continue GUI available at http://localhost:10127");
    });

    server.on("error", (err: any) => {
      console.error("Server error:", err);
      if (err.code === "EADDRINUSE") {
        console.error("Port 3002 is already in use. Please stop any other server using this port.");
      }
      else {
        console.error("An unexpected error occurred:", err);
      }
    }
    );
  }

  // Updated to support server-to-client communication via SSE
  public request(type: string, data: any, messageId: string = crypto.randomBytes(16).toString("hex")): Promise<any> {
    console.log(`Sending message to clients: ${type}`, data);

    const message = {
      messageId,
      messageType: type,
      data
    };

    // Send to all connected clients
    this.clients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch (err) {
        console.error("Error sending to client:", err);
        // Remove problematic clients
        this.clients.delete(client);
      }
    });

    // For backward compatibility, also try to invoke on core if available
    // if (this.core?.invoke) {
    //   this.core.invoke(type, data);
    // }

    // Return a resolved promise for compatibility with the caller
    return Promise.resolve(undefined);
  }

  // Optional, for Core → GUI future comms
  public sendMessageToClient?(type: string, data: any) {
    console.log("→ Frontend would receive:", type, data);
  }

  /**
   * Register a handler for a specific message type from the frontend.
   * Usage: nodeGui.on("someMessageType", async (data, messageId) => { ... })
   */
  public on(type: string, handler: Handler<any, any>) {
    this.handlers.set(type, handler);
  }
}
