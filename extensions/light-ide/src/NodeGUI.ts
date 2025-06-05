import express from "express";
import path from "path";
import crypto from "crypto";
import bodyParser from "body-parser";
type MessageHandler = (data: any, messageId?: string) => Promise<any>;

export class NodeGUI {
  private windowId: string;
  private core: any;
  private messageHandler?: (type: string, data: any, messageId?: string) => Promise<any>;
  private handlers: Map<string, MessageHandler> = new Map(); // NEW

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

  private setupServer() {
    const app = express();
    const guiDir = path.resolve(__dirname, "../../../gui/dist");
    console.log("Serving assets from:", guiDir);
    
    app.use("/assets", express.static(path.join(guiDir, "assets")));
    
    app.use(bodyParser.json());

    app.get("/", (_req, res) => {
      console.log("GET / called in NodeGUI");

      const nonce = crypto.randomBytes(16).toString("base64");
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
                    .then(async res => {
                      // Optionally, handle responses and post back to the window
                      const data = await res.json();
                      // Mimic VSCode's window.postMessage event for promise matching
                      window.postMessage({ ...msg, data: data.result }, "*");
                    })
                    .catch(console.error);
                  }
                };
              }
            window.ide = "node-ide";
            window.windowId = "${this.windowId}";
            window.vscMediaUrl = "/assets";
            window.workspacePaths = ${JSON.stringify([process.cwd()])};
            window.isFullScreen = false;
          </script>
        </body>
      </html>`;
      res.send(html);
    });

    app.post("/message", async (req: any, res: any) => {
      console.log("POST /message NodeGui", req.body);

      const { messageType, data, messageId } = req.body;
      console.log("Received message:", messageType, data, messageId);
      if (!messageType) return res.status(400).json({
        done: true,
        status: "error",
        error: "Missing 'type'"
      });

      // FIXME - the communcation does not work
      try {
        let result;
        // console.log(`handlers are`, this.handlers);
        if (this.handlers.has(messageType)) {
          result = await this.handlers.get(messageType)!(data, messageId);
        } else if (this.core.messenger.externalTypeListeners.has(messageType)) {
          // If the core has a messenger with external listeners, use that
          result = await this.core.messenger.externalTypeListeners.get(messageType)?.(data, messageId);
          console.log(`Using core.messenger for ${messageType}`, result);
        } else if (this.messageHandler) {
          result = await this.messageHandler(messageType, data, messageId);
        } else if (this.core?.invoke) {
          result = await this.core.invoke(messageType, data);
        } else {
          throw new Error("No message handler or core.invoke available.");
        }


        res.json({
          done: true,
          status: "success",
          content: result
        });
      } catch (err: any) {
        console.error("Message handling error:", err);
        res.json({
          done: true,
          status: "error",
          error: err.message ?? "Unknown error"
        });
      }
    });

    const server = app.listen(3000, () => {
      console.log("Continue GUI available at http://localhost:3000");
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

  // Optional, not currently used — may be deprecated
  public request(type: string, args: any) {
    this.core?.invoke?.(type, args);
  }

  // Optional, for Core → GUI future comms
  public sendMessageToClient?(type: string, data: any) {
    console.log("→ Frontend would receive:", type, data);
  }

  /**
   * Register a handler for a specific message type from the frontend.
   * Usage: nodeGui.on("someMessageType", async (data, messageId) => { ... })
   */
  public on(type: string, handler: MessageHandler) {
    this.handlers.set(type, handler);
  }
}
