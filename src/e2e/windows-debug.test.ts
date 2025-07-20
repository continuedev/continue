import path from "path";
import { spawn } from "child_process";
import { createTestContext, cleanupTestContext } from "../test-helpers/cli-helpers.js";

describe("Windows CI Debug", () => {
  // Only run these tests on Windows CI
  const skipTests = !(process.platform === "win32" && process.env.CI);
  
  if (skipTests) {
    it.skip("only runs on Windows CI", () => {});
    return;
  }

  it("should verify Node.js can execute the CLI file directly", async () => {
    const context = await createTestContext();
    
    try {
      // Test 1: Direct Node execution with simple --version flag
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(process.execPath, [context.cliPath, "--version"], {
          cwd: context.testDir,
          stdio: ["pipe", "pipe", "pipe"],
          shell: false,
          windowsVerbatimArguments: true,
        });
        
        let stdout = "";
        let stderr = "";
        
        proc.stdout.on("data", (data) => {
          stdout += data.toString();
        });
        
        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });
        
        proc.on("error", (error) => {
          console.error("Process spawn error:", error);
          reject(error);
        });
        
        proc.on("exit", (code, signal) => {
          console.log("Process exit:", { code, signal, stdout, stderr });
          
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Process exited with code ${code}, stderr: ${stderr}`));
          }
        });
      });
    } finally {
      await cleanupTestContext(context);
    }
  }, 30000);

  it("should capture early CLI errors", async () => {
    const context = await createTestContext();
    
    try {
      // Test 2: Try with a minimal command that should work
      await new Promise<void>((resolve, reject) => {
        const env = {
          ...process.env,
          DEBUG_CLI_TESTS: "1",
          NODE_OPTIONS: "",  // Clear any NODE_OPTIONS that might interfere
        };
        
        const proc = spawn(process.execPath, [context.cliPath, "--help"], {
          cwd: context.testDir,
          env,
          stdio: ["pipe", "pipe", "pipe"],
          shell: false,
        });
        
        let stdout = "";
        let stderr = "";
        let errorOutput = "";
        
        proc.stdout.on("data", (data) => {
          const text = data.toString();
          stdout += text;
          console.log("[STDOUT]:", text);
        });
        
        proc.stderr.on("data", (data) => {
          const text = data.toString();
          stderr += text;
          errorOutput += text;
          console.log("[STDERR]:", text);
        });
        
        proc.on("error", (error) => {
          console.error("Process spawn error:", error);
          reject(error);
        });
        
        proc.on("exit", (code, signal) => {
          console.log("Process exit details:", {
            code,
            signal,
            stdoutLength: stdout.length,
            stderrLength: stderr.length,
            hasCliStartLog: stderr.includes("[CLI_START]"),
            hasCliErrorLog: stderr.includes("[CLI_ERROR]"),
          });
          
          // Even if it fails, we want to see what happened
          if (stderr.includes("[CLI_ERROR]") || stderr.includes("Error:")) {
            console.log("Full error output:", errorOutput);
          }
          
          resolve(); // Always resolve to see the output
        });
      });
    } finally {
      await cleanupTestContext(context);
    }
  }, 30000);

  it("should test module resolution", async () => {
    const context = await createTestContext();
    
    try {
      // Test 3: Check if ESM modules are the issue
      const testScript = `
        console.log("Test script running on:", process.platform);
        console.log("Node version:", process.version);
        console.log("__dirname:", import.meta.url);
        
        try {
          await import("commander");
          console.log("SUCCESS: commander module loaded");
        } catch (e) {
          console.error("FAILED to load commander:", e.message);
        }
      `;
      
      const testFile = path.join(context.testDir, "test-esm.mjs");
      const fs = await import("fs/promises");
      await fs.writeFile(testFile, testScript);
      
      await new Promise<void>((resolve) => {
        const proc = spawn(process.execPath, [testFile], {
          cwd: context.testDir,
          stdio: ["pipe", "pipe", "pipe"],
        });
        
        proc.stdout.on("data", (data) => {
          console.log("[ESM Test STDOUT]:", data.toString());
        });
        
        proc.stderr.on("data", (data) => {
          console.log("[ESM Test STDERR]:", data.toString());
        });
        
        proc.on("exit", () => {
          resolve();
        });
      });
    } finally {
      await cleanupTestContext(context);
    }
  }, 30000);
});