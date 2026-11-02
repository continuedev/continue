#!/usr/bin/env node
/**
 * Test script for MCP Remote SSH Terminal Server
 * 
 * Tests the MCP protocol by sending JSON-RPC messages to the server
 * and verifying the responses.
 */

const { spawn } = require("node:child_process");
const path = require("node:path");

const serverProcess = spawn("node", [path.join(__dirname, "server.js")], {
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";

serverProcess.stdout.on("data", (data) => {
  buffer += data.toString();
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlineIndex);
    buffer = buffer.slice(newlineIndex + 1);
    if (line.trim()) {
      handleResponse(line);
    }
  }
});

serverProcess.stderr.on("data", (data) => {
  console.log(`[server stderr] ${data.toString().trim()}`);
});

serverProcess.on("close", (code) => {
  console.log(`\n[server closed with code ${code}]`);
  process.exit(code);
});

let messageId = 0;
const pendingRequests = new Map();

function sendRequest(method, params) {
  const id = ++messageId;
  const request = { jsonrpc: "2.0", id, method, params };
  console.log(`[send] ${JSON.stringify(request).slice(0, 100)}...`);
  serverProcess.stdin.write(JSON.stringify(request) + "\n");
  return id;
}

function sendNotification(method, params) {
  const notification = { jsonrpc: "2.0", method, params };
  console.log(`[send] ${JSON.stringify(notification).slice(0, 100)}...`);
  serverProcess.stdin.write(JSON.stringify(notification) + "\n");
}

function handleResponse(line) {
  try {
    const response = JSON.parse(line);
    if (response.id && pendingRequests.has(response.id)) {
      const { resolve, test } = pendingRequests.get(response.id);
      pendingRequests.delete(response.id);
      resolve(response);
      test(response);
    }
  } catch (e) {
    console.log(`[parse error] ${line}`);
  }
}

function waitForResponse(id) {
  return new Promise((resolve) => {
    pendingRequests.set(id, { resolve, test: () => {} });
  });
}

async function test1_initialize() {
  console.log("\n[1] Testing initialize...");
  const id = sendRequest("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  });
  
  const response = await waitForResponse(id);
  if (response.result?.serverInfo) {
    console.log(`    Server: ${response.result.serverInfo.name}`);
    console.log(`    Protocol: ${response.result.protocolVersion}`);
    console.log("[1] Initialize: OK");
  } else {
    console.log("[1] Initialize: FAIL");
    console.log(JSON.stringify(response, null, 2));
  }
}

async function test2_listTools() {
  console.log("\n[2] Testing tools/list...");
  sendNotification("notifications/initialized", {});
  
  const id = sendRequest("tools/list", {});
  const response = await waitForResponse(id);
  
  if (response.result?.tools) {
    console.log(`    Tools: ${JSON.stringify(response.result.tools.map(t => t.name))}`);
    console.log("[2] List tools: OK");
  } else {
    console.log("[2] List tools: FAIL");
    console.log(JSON.stringify(response, null, 2));
  }
}

async function test3_runEcho() {
  console.log("\n[3] Testing run_command with 'echo'...");
  const id = sendRequest("tools/call", {
    name: "run_command",
    arguments: { command: "echo 'Hello from remote SSH!'" },
  });
  
  const response = await waitForResponse(id);
  if (response.result?.content?.[0]?.text) {
    console.log(`    Output: ${response.result.content[0].text.split("\n")[2]}`);
    console.log("[3] Run 'echo': OK");
  } else {
    console.log("[3] Run 'echo': FAIL");
    console.log(JSON.stringify(response, null, 2));
  }
}

async function test4_runWhoami() {
  console.log("\n[4] Testing run_command with 'whoami && hostname'...");
  const id = sendRequest("tools/call", {
    name: "run_command",
    arguments: { command: "whoami && hostname && pwd" },
  });
  
  const response = await waitForResponse(id);
  if (response.result?.content?.[0]?.text) {
    const lines = response.result.content[0].text.split("\n");
    console.log(`    Output: ${lines.slice(3, 6).join(" | ")}`);
    console.log("[4] Run 'whoami': OK");
  } else {
    console.log("[4] Run 'whoami': FAIL");
    console.log(JSON.stringify(response, null, 2));
  }
}

async function test5_errorCase() {
  console.log("\n[5] Testing error case (ls /nonexistent)...");
  const id = sendRequest("tools/call", {
    name: "run_command",
    arguments: { command: "ls /nonexistent/path" },
  });
  
  const response = await waitForResponse(id);
  if (response.result?.content?.[0]?.text) {
    const text = response.result.content[0].text;
    if (text.includes("No such file or directory") || text.includes("exit code: 2")) {
      console.log(`    Error captured: OK`);
      console.log("[5] Error case: OK");
    } else {
      console.log(`    Unexpected output: ${text.slice(0, 100)}`);
      console.log("[5] Error case: FAIL");
    }
  } else {
    console.log("[5] Error case: FAIL");
    console.log(JSON.stringify(response, null, 2));
  }
}

async function test6_cwd() {
  console.log("\n[6] Testing run_command with cwd=/tmp...");
  const id = sendRequest("tools/call", {
    name: "run_command",
    arguments: { command: "pwd", cwd: "/tmp" },
  });
  
  const response = await waitForResponse(id);
  if (response.result?.content?.[0]?.text) {
    const text = response.result.content[0].text;
    if (text.includes("/tmp")) {
      console.log(`    CWD: /tmp (correct)`);
      console.log("[6] CWD test: OK");
    } else {
      console.log(`    Unexpected CWD: ${text.slice(0, 100)}`);
      console.log("[6] CWD test: FAIL");
    }
  } else {
    console.log("[6] CWD test: FAIL");
    console.log(JSON.stringify(response, null, 2));
  }
}

// Run all tests
async function runTests() {
  console.log("=== MCP Remote SSH Terminal Server Test ===\n");
  
  await test1_initialize();
  await test2_listTools();
  await test3_runEcho();
  await test4_runWhoami();
  await test5_errorCase();
  await test6_cwd();
  
  console.log("\n=== All tests completed! ===");
  serverProcess.kill();
}

runTests().catch(console.error);
