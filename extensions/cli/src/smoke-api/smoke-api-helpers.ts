import fs from "fs/promises";
import os from "os";
import path from "path";

import { execaNode, type Subprocess } from "execa";

export interface SmokeTestContext {
  cliPath: string;
  testDir: string;
  configPath: string;
}

/**
 * Creates an isolated test directory and resolves the CLI entry point.
 */
export async function createSmokeContext(): Promise<SmokeTestContext> {
  const cliPath = path.resolve("dist/cn.js");

  try {
    await fs.access(cliPath);
  } catch {
    throw new Error(`CLI not found at ${cliPath}. Run 'npm run build' first.`);
  }

  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cn-smoke-"));

  // Create onboarding flag so the CLI skips onboarding flow
  const continueDir = path.join(testDir, ".continue");
  await fs.mkdir(continueDir, { recursive: true });
  await fs.writeFile(
    path.join(continueDir, ".onboarding_complete"),
    new Date().toISOString(),
  );

  return { cliPath, testDir, configPath: "" };
}

/**
 * Removes the temp directory created by createSmokeContext.
 */
export async function cleanupSmokeContext(
  ctx: SmokeTestContext,
): Promise<void> {
  try {
    await fs.rm(ctx.testDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// Override via SMOKE_MODEL env var. Falls back to claude-3-haiku which is
// widely available and cheap.
const SMOKE_MODEL = process.env.SMOKE_MODEL || "claude-3-haiku-20240307";

/**
 * Writes a YAML config that points at the real Anthropic API.
 */
export async function writeAnthropicConfig(
  ctx: SmokeTestContext,
  apiKey: string,
): Promise<string> {
  const yaml = `name: Smoke Test
version: 1.0.0
schema: v1
models:
  - name: smoke-haiku
    model: ${SMOKE_MODEL}
    provider: anthropic
    apiKey: "${apiKey}"
    defaultCompletionOptions:
      maxTokens: 1024
    roles:
      - chat
`;
  const configPath = path.join(ctx.testDir, "smoke-config.yaml");
  await fs.writeFile(configPath, yaml);
  ctx.configPath = configPath;
  return configPath;
}

// continue-proxy requires a 4-part model name (owner/package/provider/model).
// Override via SMOKE_PROXY_MODEL env var.
const SMOKE_PROXY_MODEL = process.env.SMOKE_PROXY_MODEL || "";

/**
 * Writes a YAML config that uses the Continue proxy (CONTINUE_API_KEY).
 * Requires SMOKE_PROXY_MODEL to be set to a valid proxy model name.
 */
export async function writeContinueProxyConfig(
  ctx: SmokeTestContext,
  apiKey: string,
): Promise<string> {
  const yaml = `name: Smoke Test
version: 1.0.0
schema: v1
models:
  - name: smoke-haiku
    model: ${SMOKE_PROXY_MODEL}
    provider: continue-proxy
    apiKey: "${apiKey}"
    defaultCompletionOptions:
      maxTokens: 1024
    roles:
      - chat
`;
  const configPath = path.join(ctx.testDir, "smoke-config.yaml");
  await fs.writeFile(configPath, yaml);
  ctx.configPath = configPath;
  return configPath;
}

/**
 * Runs `cn` (headless) and returns stdout/stderr/exitCode.
 */
export async function runHeadless(
  ctx: SmokeTestContext,
  args: string[],
  opts: { timeout?: number; env?: Record<string, string> } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { timeout = 60000, env = {} } = opts;

  const result = await execaNode(ctx.cliPath, args, {
    cwd: ctx.testDir,
    env: {
      ...process.env,
      CONTINUE_CLI_TEST: "true",
      HOME: ctx.testDir,
      USERPROFILE: ctx.testDir,
      FORCE_NO_TTY: "true",
      ...env,
    },
    timeout,
    reject: false,
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 0,
  };
}

/**
 * Spawns `cn serve` as a background subprocess and returns it along with
 * a helper to wait for the server to be ready.
 */
export function spawnServe(
  ctx: SmokeTestContext,
  args: string[],
  opts: { env?: Record<string, string> } = {},
): Subprocess {
  return execaNode(ctx.cliPath, ["serve", ...args], {
    cwd: ctx.testDir,
    env: {
      ...process.env,
      CONTINUE_CLI_TEST: "true",
      HOME: ctx.testDir,
      USERPROFILE: ctx.testDir,
      ...opts.env,
    },
    reject: false,
  });
}

/**
 * Waits for a pattern to appear in the subprocess stdout/stderr.
 */
export function waitForPattern(
  proc: Subprocess,
  pattern: string,
  timeout = 30000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Timeout (${timeout}ms) waiting for pattern: "${pattern}"\nCollected output:\n${output}`,
        ),
      );
    }, timeout);

    const check = (data: string) => {
      output += data;
      if (output.includes(pattern)) {
        clearTimeout(timer);
        resolve(output);
      }
    };

    proc.stdout?.setEncoding("utf8").on("data", check);
    proc.stderr?.setEncoding("utf8").on("data", check);

    proc.on("exit", () => {
      clearTimeout(timer);
      reject(
        new Error(
          `Process exited before pattern "${pattern}" was found.\nCollected output:\n${output}`,
        ),
      );
    });
  });
}

/**
 * Polls GET /state until the agent has finished processing a response.
 *
 * Because there is a small gap between POST /message returning and the
 * server flipping isProcessing to true, we first wait for isProcessing
 * to become true (or for an assistant message to appear), then wait for
 * isProcessing to become false.
 */
export async function pollUntilIdle(
  baseUrl: string,
  timeout = 60000,
  interval = 1000,
): Promise<any> {
  const deadline = Date.now() + timeout;
  let sawProcessing = false;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/state`);
      if (res.ok) {
        const state = await res.json();

        if (state.isProcessing) {
          sawProcessing = true;
        }

        // Only return when we know the agent actually ran:
        // either we saw it processing and it stopped, or there's
        // already an assistant message in the history.
        if (!state.isProcessing && sawProcessing) {
          return state;
        }

        const history = state.session?.history ?? [];
        const hasAssistant = history.some(
          (item: any) => item.message?.role === "assistant",
        );
        if (!state.isProcessing && hasAssistant) {
          return state;
        }
      }
    } catch {
      // server not ready yet — retry
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`pollUntilIdle timed out after ${timeout}ms`);
}

/**
 * Gracefully shuts down a serve subprocess via POST /exit, then kills it.
 */
export async function shutdownServe(
  proc: Subprocess,
  baseUrl: string,
): Promise<void> {
  try {
    await fetch(`${baseUrl}/exit`, { method: "POST" });
  } catch {
    // server may already be gone
  }

  // Give it a moment to close gracefully
  await new Promise((r) => setTimeout(r, 500));

  if (!proc.killed) {
    proc.kill("SIGTERM");
  }
}
