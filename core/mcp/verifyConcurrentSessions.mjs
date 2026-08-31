/**
 * Verifies that shadow-code's MCP server can serve several agent runs at once -
 * the thing parallel subagents on the `claudecode` provider depend on.
 *
 * Run from the `core/` directory:
 *
 *     node mcp/verifyConcurrentSessions.mjs
 *
 * Expected output: both runs return 200 with DIFFERENT mcp-session-id values.
 *
 * Why this is a script and not a Vitest: the assertion has to go through a real
 * HTTP round-trip into @modelcontextprotocol/sdk's transport, and under Vitest
 * that transport's response conversion throws
 * "res.body.getReader is not a function" inside @hono/node-server - an artifact
 * of Vitest's globals, unrelated to the code under test.
 *
 * Background: StreamableHTTPServerTransport in stateful mode binds to exactly
 * one MCP client. A second `initialize` on the same transport is rejected with
 * HTTP 400 "Invalid Request: Server already initialized", and close() never
 * resets that flag. shadowCodeToolsServer.ts therefore keeps one transport per
 * agent run, keyed by the ?continueSessionId= query param. Swap getOrCreate()
 * below for a single shared transport and run-b turns into a 400 - that was the
 * behavior before the per-run change.
 */
import { randomUUID } from "node:crypto";
import * as http from "node:http";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const sessions = new Map();

function getOrCreate(key) {
  if (sessions.has(key)) {
    return sessions.get(key);
  }
  const created = (async () => {
    const server = new Server(
      { name: "shadow-code", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    await server.connect(transport);
    return { server, transport };
  })();
  sessions.set(key, created);
  return created;
}

const httpServer = http.createServer((req, res) => {
  const key =
    new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get(
      "continueSessionId",
    ) ?? "__default__";

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    void (async () => {
      try {
        const { transport } = await getOrCreate(key);
        await transport.handleRequest(
          req,
          res,
          body ? JSON.parse(body) : undefined,
        );
      } catch (e) {
        console.error("request failed", e);
        if (!res.headersSent) res.writeHead(500);
        res.end("{}");
      }
    })();
  });
});

const port = await new Promise((resolve) =>
  httpServer.listen(0, "127.0.0.1", () => resolve(httpServer.address().port)),
);
const base = `http://127.0.0.1:${port}/mcp`;

const initialize = (key) =>
  fetch(`${base}?continueSessionId=${key}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "verify", version: "1.0.0" },
      },
    }),
  });

const [a, b] = await Promise.all([initialize("run-a"), initialize("run-b")]);
const sessionA = a.headers.get("mcp-session-id");
const sessionB = b.headers.get("mcp-session-id");

console.log(`run-a: ${a.status} mcp-session-id=${sessionA}`);
console.log(`run-b: ${b.status} mcp-session-id=${sessionB}`);

const ok = a.status === 200 && b.status === 200 && sessionA !== sessionB;
console.log(ok ? "PASS: concurrent sessions supported" : "FAIL");

// Close the transports before the server, otherwise their still-open SSE
// handles trip a libuv assertion on Windows during teardown.
for (const pending of sessions.values()) {
  const { server, transport } = await pending;
  await transport.close();
  await server.close();
}
console.log("transports closed cleanly");
// No process.exit(): let Node drain its handles on its own. Forcing an exit
// while the SDK's SSE handles are still closing trips a libuv assertion on
// Windows, which is a property of the abrupt exit, not of close().
httpServer.close();
process.exitCode = ok ? 0 : 1;
