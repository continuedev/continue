import express from "express";
import path from "path";
import crypto from "crypto";
import bodyParser from "body-parser";

export class NodeGUI {
  private windowId: string;
  private core: any;
  private messageHandler?: (type: string, data: any, messageId?: string) => Promise<any>;

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

    app.use("/assets", express.static(path.join(guiDir, "assets")));
    app.use(bodyParser.json());

    app.get("/", (_req, res) => {
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
      const { type, args, messageId } = req.body;
      if (!type) return res.status(400).send("Missing 'type'");

      try {
        let result;
        if (this.messageHandler) {
          result = await this.messageHandler(type, args, messageId);
        } else if (this.core?.invoke) {
          result = await this.core.invoke(type, args);
        } else {
          throw new Error("No message handler or core.invoke available.");
        }

        res.json({ result });
      } catch (err: any) {
        console.error("Message handling error:", err);
        res.status(500).send(err.message ?? "Unknown error");
      }
    });

    app.listen(3000, () => {
      console.log("Continue GUI available at http://localhost:3000");
    });
  }

  // Optional, not currently used — may be deprecated
  public request(type: string, args: any) {
    this.core?.invoke?.(type, args);
  }

  // Optional, for Core → GUI future comms
  public sendMessageToClient?(type: string, data: any) {
    console.log("→ Frontend would receive:", type, data);
  }
}
