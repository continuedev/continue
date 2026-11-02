#!/usr/bin/env node
/**
 * Test script for MCP Remote Terminal Server
 * Sends MCP protocol messages via stdio and verifies responses.
 */

const { spawn } = require("node:child_process");
const path = require("node:path");

const serverPath = path.join(__dirname, "server.js");
const child = spawn("node", [serverPath], {
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
const responses = [];

child.stdout.on("data", (data) => {
  buffer += data.toString();
  // MCP uses newline-delimited JSON
  const lines = buffer.split("\n");
  buffer = lines.pop(); // Keep incomplete line in buffer
  for (const line of lines) {
    if (line.trim()) {
      try {
        responses.push(JSON.parse(line));
      } catch (e) {
        console.error("Failed to parse:", line);
      }
    }
  }
});

child.stderr.on("data", (data) => {
  console.error("[server stderr]", data.toString().trim());
});

function send(message) {
  console.log("[send]", JSON.stringify(message).slice(0, 100));
  child.stdin.write(JSON.stringify(message) + "\n");
}

function waitForResponse(predicate, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      const found = responses.find(predicate);
      if (found) {
        resolve(found);
      } else if (Date.now() - startTime > timeoutMs) {
        reject(new Error("Timeout waiting for response"));
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

async function main() {
  console.log("=== MCP Remote Terminal Server Test ===\n");

  // 1. Initialize
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  });

  const initResponse = await waitForResponse((r) => r.id === 1);
  console.log("[1] Initialize: OK");
  console.log("    Server:", initResponse.result?.serverInfo?.name);
  console.log("    Protocol:", initResponse.result?.protocolVersion);

  // Send initialized notification
  send({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });

  // Wait a bit
  await new Promise((r) => setTimeout(r, 200));

  // 2. List tools
  send({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });

  const toolsResponse = await waitForResponse((r) => r.id === 2);
  console.log("\n[2] List tools: OK");
  console.log("    Tools:", toolsResponse.result?.tools?.map((t) => t.name));

  // 3. Call run_command - simple echo
  send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "run_command",
      arguments: { command: "echo 'Hello from remote terminal!'" },
    },
  });

  const echoResponse = await waitForResponse((r) => r.id === 3);
  console.log("\n[3] Run 'echo': OK");
  console.log("    Output:", echoResponse.result?.content?.[0]?.text);

  // 4. Call run_command - check environment
  send({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "run_command",
      arguments: { command: "whoami && hostname && pwd" },
    },
  });

  const envResponse = await waitForResponse((r) => r.id === 4);
  console.log("\n[4] Run 'whoami && hostname && pwd': OK");
  console.log("    Output:", envResponse.result?.content?.[0]?.text);

  // 5. Call run_command - test error handling
  send({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "run_command",
      arguments: { command: "ls /nonexistent/path" },
    },
  });

  const errorResponse = await waitForResponse((r) => r.id === 5);
  console.log("\n[5] Run 'ls /nonexistent' (error test): OK");
  console.log("    Output:", errorResponse.result?.content?.[0]?.text?.slice(0, 200));

  // 6. Call run_command - test with cwd
  send({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "run_command",
      arguments: { command: "pwd", cwd: "/tmp" },
    },
  });

  const cwdResponse = await waitForResponse((r) => r.id === 6);
  console.log("\n[6] Run 'pwd' with cwd=/tmp: OK");
  console.log("    Output:", cwdResponse.result?.content?.[0]?.text);

  console.log("\n=== All tests passed! ===");

  child.kill();
  process.exit(0);
}

main().catch((error) => {
  console.error("\nTest failed:", error.message);
  child.kill();
  process.exit(1);
});
