import { execaNode, type Subprocess } from "execa";
import fs from "fs/promises";
import os from "os";
import path from "path";

export interface CLITestContext {
  cliPath: string;
  testDir: string;
  configPath?: string;
  sessionPath?: string;
}

export interface CLIRunOptions {
  args?: string[];
  input?: string;
  env?: Record<string, string>;
  timeout?: number;
  expectError?: boolean;
}

export interface CLIRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: Error;
}

/**
 * Creates a test context with isolated test directory
 */
export async function createTestContext(): Promise<CLITestContext> {
  const cliPath = path.resolve("dist/index.js");
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cn-test-"));

  return {
    cliPath,
    testDir,
  };
}

/**
 * Cleans up test context
 */
export async function cleanupTestContext(
  context: CLITestContext
): Promise<void> {
  try {
    await fs.rm(context.testDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Runs the CLI with given options
 */
export async function runCLI(
  context: CLITestContext,
  options: CLIRunOptions = {}
): Promise<CLIRunResult> {
  const {
    args = [],
    input,
    env = {},
    timeout = 10000,
    expectError = false,
  } = options;

  const execOptions = {
    cwd: context.testDir,
    env: {
      ...process.env,
      CONTINUE_CLI_TEST: "true",
      HOME: context.testDir,
      // Windows-specific home directory variables
      USERPROFILE: context.testDir,
      HOMEDRIVE: path.parse(context.testDir).root,
      HOMEPATH: path.relative(
        path.parse(context.testDir).root,
        context.testDir
      ),
      ...env,
    },
    timeout,
    reject: false,
    input,
    // Force Windows to use the correct stdout/stderr handling
    windowsVerbatimArguments: true,
    // Ensure proper encoding
    encoding: 'utf8' as const,
    // Increase buffer size for Windows
    maxBuffer: 10 * 1024 * 1024, // 10MB
  };

  try {
    const result = await execaNode(context.cliPath, args, execOptions);

    // Ensure stdout/stderr are always strings
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    
    // Log for debugging Windows issues
    if (process.env.DEBUG_CLI_TESTS) {
      console.log("CLI Result:", {
        stdout: stdout.substring(0, 200),
        stderr: stderr.substring(0, 200),
        exitCode: result.exitCode,
      });
    }

    return {
      stdout,
      stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (error: any) {
    // Always capture stdout/stderr even on error
    const stdout = error.stdout ?? "";
    const stderr = error.stderr ?? "";
    const exitCode = error.exitCode ?? 1;
    
    if (!expectError) {
      // Include more details in error for debugging
      const errorDetails = {
        message: error.message,
        stdout: stdout.substring(0, 500),
        stderr: stderr.substring(0, 500),
        exitCode,
        command: error.command,
        cwd: execOptions.cwd,
        cliPath: context.cliPath,
        args,
      };
      console.error("CLI execution failed:", errorDetails);
      
      // On Windows, if we get empty output, it might be a Node.js path issue
      if (process.platform === "win32" && !stdout && !stderr) {
        console.error("Windows: No output captured. This might be a Node.js execution issue.");
      }
      
      throw error;
    }

    return {
      stdout,
      stderr,
      exitCode,
      error,
    };
  }
}

/**
 * Creates a test configuration file
 */
export async function createTestConfig(
  context: CLITestContext,
  config: any
): Promise<string> {
  const configPath = path.join(context.testDir, "test-config.yaml");
  const configContent =
    typeof config === "string" ? config : JSON.stringify(config, null, 2);

  await fs.writeFile(configPath, configContent);
  context.configPath = configPath;

  return configPath;
}

/**
 * Creates a test rule file
 */
export async function createTestRule(
  context: CLITestContext,
  ruleName: string,
  content: string
): Promise<string> {
  const rulePath = path.join(context.testDir, `${ruleName}.md`);
  await fs.writeFile(rulePath, content);
  return rulePath;
}

/**
 * Reads the session file if it exists
 */
export async function readSession(
  context: CLITestContext
): Promise<any | null> {
  try {
    const sessionDir = path.join(context.testDir, ".continue", "sessions");
    const files = await fs.readdir(sessionDir);

    if (files.length === 0) {
      return null;
    }

    // Get the most recent session file
    const sessionFile = files.sort().pop()!;
    const sessionPath = path.join(sessionDir, sessionFile);
    const content = await fs.readFile(sessionPath, "utf-8");

    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Creates a mock session file
 */
export async function createMockSession(
  context: CLITestContext,
  messages: any[]
): Promise<string> {
  const sessionDir = path.join(context.testDir, ".continue", "sessions");
  await fs.mkdir(sessionDir, { recursive: true });

  const sessionId = `test-session-${Date.now()}`;
  const sessionPath = path.join(sessionDir, `${sessionId}.json`);

  const session = {
    id: sessionId,
    timestamp: new Date().toISOString(),
    messages,
    config: {},
  };

  await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
  context.sessionPath = sessionPath;

  return sessionPath;
}

/**
 * Waits for a pattern in the output
 */
export function waitForPattern(
  proc: Subprocess,
  pattern: RegExp | string,
  timeout: number = 5000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout waiting for pattern: ${pattern}`));
    }, timeout);

    const checkOutput = (data: string) => {
      output += data;
      const match =
        typeof pattern === "string"
          ? output.includes(pattern)
          : pattern.test(output);

      if (match) {
        clearTimeout(timer);
        resolve(output);
      }
    };

    proc.stdout?.on("data", checkOutput);
    proc.stderr?.on("data", checkOutput);
  });
}

/**
 * Simulates user input in interactive mode
 */
export async function withInteractiveInput(
  context: CLITestContext,
  args: string[],
  inputs: string[]
): Promise<CLIRunResult> {
  const proc = execaNode(context.cliPath, args, {
    cwd: context.testDir,
    env: {
      ...process.env,
      CONTINUE_CLI_TEST: "true",
      HOME: context.testDir,
      // Windows-specific home directory variables
      USERPROFILE: context.testDir,
      HOMEDRIVE: path.parse(context.testDir).root,
      HOMEPATH: path.relative(
        path.parse(context.testDir).root,
        context.testDir
      ),
    },
  });

  let stdout = "";
  let stderr = "";

  proc.stdout?.on("data", (data) => {
    stdout += data;
  });

  proc.stderr?.on("data", (data) => {
    stderr += data;
  });

  // Send inputs sequentially
  for (const input of inputs) {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
    proc.stdin?.write(input + "\n");
  }

  // End input
  proc.stdin?.end();

  try {
    const result = await proc;
    return {
      stdout,
      stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (error: any) {
    return {
      stdout,
      stderr,
      exitCode: error.exitCode ?? 1,
      error,
    };
  }
}
