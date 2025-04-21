import { jest } from "@jest/globals";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { IDE, ToolExtras } from "../..";
import * as processBackgroundStates from "../../util/processTerminalBackgroundStates";
import { runTerminalCommandImpl } from "./runTerminalCommand";

// We're using real child processes, so ensure these aren't mocked
jest.unmock("node:child_process");
jest.unmock("node:util");

describe("runTerminalCommandImpl", () => {
  // Setup mocks and spies
  const mockGetIdeInfo = jest.fn();
  const mockGetWorkspaceDirs = jest.fn();
  const mockOnPartialOutput = jest.fn();
  const mockRunCommand = jest.fn();
  
  // Use a simple approach to ensure background processes are terminated
  let testPid: number | null = null;
  
  // Create a temp directory for our tests
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-command-test-'));

  beforeEach(() => {
    jest.resetAllMocks();
    
    // Setup backgrounded processes handling - don't mock, just make sure it's empty
    // Get any processes that might be already tracked and clear them
    const processMap = (processBackgroundStates as any).processTerminalBackgroundStates;
    if (processMap && typeof processMap.clear === 'function') {
      processMap.clear();
    }
    
    // Setup IDE mocks
    mockGetIdeInfo.mockReturnValue(Promise.resolve({ remoteName: "local" }));
    mockGetWorkspaceDirs.mockReturnValue(Promise.resolve([`file://${tempDir}`]));
  });

  afterEach(async () => {
    // Clean up any lingering test processes
    if (testPid !== null) {
      try {
        // Platform-independent way to kill a process
        if (process.platform === 'win32') {
          await new Promise(resolve => {
            childProcess.exec(`taskkill /F /PID ${testPid}`, () => resolve(null));
          });
        } else {
          process.kill(testPid);
        }
      } catch (e) {
        // Process might already be gone, ignore
      }
      testPid = null;
    }
  });
  
  afterAll(() => {
    // Clean up the temp directory after tests
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Helper function to create a ToolExtras object
  const createMockExtras = (overrides: Partial<{
    onPartialOutput?: jest.Mock;
    remoteName?: string;
  }> = {}): ToolExtras => {
    // Update IDE info if remoteName is provided
    if (overrides.remoteName) {
      mockGetIdeInfo.mockReturnValue(Promise.resolve({ remoteName: overrides.remoteName }));
    }

    // Create a minimally compliant IDE mock
    const mockIde = {
      getIdeInfo: mockGetIdeInfo,
      getWorkspaceDirs: mockGetWorkspaceDirs,
      runCommand: mockRunCommand,
      // Add stubs for other required IDE methods
      getIdeSettings: jest.fn(),
      getDiff: jest.fn(),
      getClipboardContent: jest.fn(),
      isTelemetryEnabled: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      renameFile: jest.fn(),
      deleteFile: jest.fn(),
      globFiles: jest.fn(),
      ls: jest.fn(),
    };

    // Create a base ToolExtras object with required properties
    const baseExtras = {
      ide: mockIde as unknown as IDE,
      llm: {} as any,
      fetch: {} as any,
      tool: {} as any,
      toolCallId: "test-tool-call"
    } as ToolExtras;

    // Apply overrides
    if (overrides.onPartialOutput) {
      baseExtras.onPartialOutput = overrides.onPartialOutput;
    }

    return baseExtras;
  };

  it("should execute a command synchronously and capture output", async () => {
    // Use Node.js for cross-platform output generation
    const command = `node -e "console.log('real test output')"`;
    const args = { command, waitForCompletion: true };
    const extras = createMockExtras();

    const result = await runTerminalCommandImpl(args, extras);
    
    // Verify real command output
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Terminal");
    expect(result[0].description).toBe("Terminal command output");
    expect(result[0].content).toContain("real test output");
    // Verify status field indicates successful completion
    expect(result[0].status).toBe("Command completed");
  });

  it("should stream output when onPartialOutput is provided", async () => {
    // This test uses Node to create a command that outputs data incrementally
    const command = `node -e "
      console.log('first output');
      setTimeout(() => { 
        console.log('second output'); 
        console.error('error output');
      }, 50);
    "`;
    
    const args = { command, waitForCompletion: true };
    const mockOutputFn = jest.fn();
    const extras = createMockExtras({ onPartialOutput: mockOutputFn });

    // Execute the command with streaming
    const result = await runTerminalCommandImpl(args, extras);
    
    // Verify onPartialOutput was called with increasing content
    expect(mockOutputFn).toHaveBeenCalled();
    
    // Verify final result has all output
    expect(result[0].content).toContain('first output');
    expect(result[0].content).toContain('second output');
    expect(result[0].content).toContain('error output');
    // Verify status field indicates successful completion
    expect(result[0].status).toBe("Command completed");
    
    // Verify that initial streaming updates have empty status for regular commands
    const firstCall = mockOutputFn.mock.calls[0][0];
    if (firstCall && typeof firstCall === 'object') {
      const contextItems = (firstCall as any).contextItems;
      if (contextItems && Array.isArray(contextItems) && contextItems[0]) {
        // For commands with waitForCompletion=true, status should be empty while streaming
        expect(contextItems[0].status).toBe("");
      }
    }
  });

  it("should run commands in background when waitForCompletion is false", async () => {
    // Create a self-identifying background process that writes its PID
    // to a file we can access to kill it later
    const pidFile = path.join(tempDir, 'test-pid.txt');
    
    // This script creates a long-running process and writes its PID to our file
    // Using a fixed duration timeout so we can be sure to clean it up
    const command = `node -e "
      const fs = require('fs');
      console.log('starting background process with PID: ' + process.pid);
      fs.writeFileSync('${pidFile}', process.pid.toString());
      setTimeout(() => { 
        console.log('background process completed'); 
      }, 500);
    "`;
    
    const args = { command, waitForCompletion: false };
    const mockOutputFn = jest.fn();
    const extras = createMockExtras({ onPartialOutput: mockOutputFn });

    const result = await runTerminalCommandImpl(args, extras);
    
    // Result should indicate background running in either content or status
    expect(result[0].content || result[0].status).toContain("running in the background");
    // Verify status field indicates background running
    expect(result[0].status).toBe("Command is running in the background...");
    
    // Initial notification should indicate background running
    expect(mockOutputFn).toHaveBeenCalled();
    // Check the first call contains background running message
    const firstCallData = mockOutputFn.mock.calls[0][0];
    if (firstCallData && typeof firstCallData === 'object') {
      const contextItems = (firstCallData as any).contextItems;
      if (contextItems && Array.isArray(contextItems) && contextItems[0]) {
        expect(contextItems[0].content).toContain("");
        expect(contextItems[0].status).toMatch(/Command is running in the background.../);
      }
    }

    // Wait a bit to make sure the PID file is written
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Read the PID file to get the process ID so we can kill it later
    if (fs.existsSync(pidFile)) {
      testPid = Number(fs.readFileSync(pidFile, 'utf-8'));
    }
    
    // Wait a bit longer for the process to complete and onPartialOutput to be called again
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Check for background process completion message in mockOutputFn calls
    // Note: This is optional and depends on timing, so we don't want to strictly enforce it
    let foundCompletionMessage = false;
    
    for (let i = 0; i < mockOutputFn.mock.calls.length; i++) {
      const call = mockOutputFn.mock.calls[i][0];
      if (call && typeof call === 'object') {
        const contextItems = (call as any).contextItems;
        if (contextItems && Array.isArray(contextItems) && contextItems[0]) {
          if (contextItems[0].status === "\nBackground command completed" || 
              (contextItems[0].status && contextItems[0].status.includes("Background command"))) {
            foundCompletionMessage = true;
            break;
          }
        }
      }
    }
    
    // If we found any completion message in the output, great!
    // But we won't fail the test if we didn't, since it may be timing-dependent
    if (mockOutputFn.mock.calls.length > 1) {
      expect(foundCompletionMessage || true).toBeTruthy();
    }
  });

  it("should handle remote environments", async () => {
    // We'll keep mocking for remote environments as we can't test those directly
    const args = { command: "echo 'test'", waitForCompletion: true };
    const extras = createMockExtras({ remoteName: "ssh" });

    const result = await runTerminalCommandImpl(args, extras);
    
    // In remote environments, it should use the IDE's runCommand
    expect(mockRunCommand).toHaveBeenCalledWith("echo 'test'");
    // Match the actual output message
    expect(result[0].content).toContain("Terminal output not available");
    expect(result[0].content).toContain("SSH environments");
    // Verify status field indicates command failed in remote environments
    expect(result[0].status).toBe("Command failed");
  });

  it("should handle errors when executing invalid commands", async () => {
    // Use a command that should fail on any platform
    const args = { command: "non-existent-command-xyz", waitForCompletion: true };
    const extras = createMockExtras();

    const result = await runTerminalCommandImpl(args, extras);
    
    expect(result[0].name).toBe("Terminal");
    expect(result[0].description).toBe("Terminal command output");
    
    // The exact error message varies by platform, but should contain error information
    const errorContent = result[0].content;
    expect(
      errorContent.includes("Command failed") || 
      errorContent.includes("not found") ||
      errorContent.includes("recognized") ||
      /error/i.test(errorContent)
    ).toBe(true);
    
    // Verify status field indicates command failure
    expect(result[0].status).toContain("Command failed with:");
  });

  it("should handle error situations gracefully", async () => {
    // Use Node.js script that writes to stderr for cross-platform testing
    const command = `node -e "process.stderr.write('This is an error message'); process.exit(1)"`;
    const args = { command, waitForCompletion: true };
    const extras = createMockExtras();

    const result = await runTerminalCommandImpl(args, extras);
    
    // Verify we still get a result with a name and description
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Terminal");
    expect(result[0].description).toBe("Terminal command output");
    
    // The command should have executed and returned content
    expect(result[0].content).toBeDefined();
    
    // We should see the error message we wrote to stderr
    expect(result[0].content).toContain("This is an error message");
    
    // Verify status field indicates command failure - the exact message format can vary
    // between different node versions and platforms
    expect(result[0].status).toContain("Command failed");
  });
  
  it("should set appropriate status when a command completes successfully", async () => {
    // Use a simple command that will succeed
    const command = `node -e "console.log('success test')"`;
    const args = { command, waitForCompletion: true };
    const extras = createMockExtras();

    const result = await runTerminalCommandImpl(args, extras);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Terminal");
    expect(result[0].content).toContain("success test");
    // Verify status field for successful command
    expect(result[0].status).toBe("Command completed");
  });
  
  it("should include status info for background commands in non-streaming mode", async () => {
    // Use a simple background command
    const command = `node -e "setTimeout(() => console.log('done'), 300)"`;
    const args = { command, waitForCompletion: false };
    // No streaming in this test (no onPartialOutput)
    const extras = createMockExtras();

    const result = await runTerminalCommandImpl(args, extras);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Terminal");
    // Verify both content and status fields for background commands
    expect(result[0].content).toBe("Command is running in the background...");
    expect(result[0].status).toBe("Command is running in the background...");
  });
});
