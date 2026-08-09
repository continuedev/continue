/**
 * Tests for the hooks system: config loading, matcher matching,
 * hook execution (command and HTTP), exit code semantics,
 * JSON output parsing, result aggregation, and deduplication.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getMatchingHookGroups, loadHooksConfig } from "./hookConfig.js";
import { runHooks } from "./hookRunner.js";
import type {
  HookMatcherGroup,
  HooksConfig,
  PreToolUseInput,
  SessionStartInput,
  StopInput,
  UserPromptSubmitInput,
} from "./types.js";

// ---------------------------------------------------------------------------
// hookConfig tests
// ---------------------------------------------------------------------------

describe("hookConfig", () => {
  describe("getMatchingHookGroups", () => {
    const baseGroup: HookMatcherGroup = {
      hooks: [{ type: "command", command: "echo hello" }],
    };

    it("matches when no matcher is set", () => {
      const config: HooksConfig = {
        PreToolUse: [baseGroup],
      };
      const result = getMatchingHookGroups(config, "PreToolUse", "Bash");
      expect(result).toHaveLength(1);
    });

    it("matches when matcher is empty string", () => {
      const config: HooksConfig = {
        PreToolUse: [{ matcher: "", hooks: baseGroup.hooks }],
      };
      const result = getMatchingHookGroups(config, "PreToolUse", "Bash");
      expect(result).toHaveLength(1);
    });

    it("matches when matcher is '*'", () => {
      const config: HooksConfig = {
        PreToolUse: [{ matcher: "*", hooks: baseGroup.hooks }],
      };
      const result = getMatchingHookGroups(config, "PreToolUse", "Bash");
      expect(result).toHaveLength(1);
    });

    it("matches with regex matcher", () => {
      const config: HooksConfig = {
        PreToolUse: [{ matcher: "^Bash$", hooks: baseGroup.hooks }],
      };
      expect(getMatchingHookGroups(config, "PreToolUse", "Bash")).toHaveLength(
        1,
      );
      expect(getMatchingHookGroups(config, "PreToolUse", "Read")).toHaveLength(
        0,
      );
    });

    it("matches partial regex", () => {
      const config: HooksConfig = {
        PreToolUse: [{ matcher: "File", hooks: baseGroup.hooks }],
      };
      expect(
        getMatchingHookGroups(config, "PreToolUse", "ReadFile"),
      ).toHaveLength(1);
      expect(getMatchingHookGroups(config, "PreToolUse", "Bash")).toHaveLength(
        0,
      );
    });

    it("returns empty for missing event", () => {
      const config: HooksConfig = {};
      expect(getMatchingHookGroups(config, "PreToolUse", "Bash")).toHaveLength(
        0,
      );
    });

    it("matches all groups for an event when matcher value is undefined (no-matcher events)", () => {
      const config: HooksConfig = {
        UserPromptSubmit: [
          { matcher: "something", hooks: baseGroup.hooks },
          baseGroup,
        ],
      };
      // UserPromptSubmit is a no-matcher event, matcherValue is undefined
      const result = getMatchingHookGroups(
        config,
        "UserPromptSubmit",
        undefined,
      );
      expect(result).toHaveLength(2);
    });

    it("handles invalid regex gracefully", () => {
      const config: HooksConfig = {
        PreToolUse: [{ matcher: "[invalid", hooks: baseGroup.hooks }],
      };
      // Invalid regex should not match
      expect(getMatchingHookGroups(config, "PreToolUse", "Bash")).toHaveLength(
        0,
      );
    });

    it("filters multiple groups correctly", () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            matcher: "^Bash$",
            hooks: [{ type: "command", command: "echo a" }],
          },
          {
            matcher: "^Read$",
            hooks: [{ type: "command", command: "echo b" }],
          },
          { hooks: [{ type: "command", command: "echo c" }] }, // matches all
        ],
      };
      const result = getMatchingHookGroups(config, "PreToolUse", "Bash");
      expect(result).toHaveLength(2); // ^Bash$ and wildcard
    });
  });

  describe("loadHooksConfig", () => {
    let tmpDir: string;
    let fakeHome: string;
    let projectDir: string;
    let originalContinueGlobalDir: string | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-test-"));
      // Use separate dirs for home and project to avoid path collision
      fakeHome = path.join(tmpDir, "home");
      projectDir = path.join(tmpDir, "project");
      fs.mkdirSync(fakeHome, { recursive: true });
      fs.mkdirSync(projectDir, { recursive: true });
      // Override CONTINUE_GLOBAL_DIR so that user-global settings
      // from the real ~/.continue/settings.json don't leak into tests
      originalContinueGlobalDir = process.env.CONTINUE_GLOBAL_DIR;
      process.env.CONTINUE_GLOBAL_DIR = path.join(fakeHome, ".continue");
    });

    afterEach(() => {
      if (originalContinueGlobalDir === undefined) {
        delete process.env.CONTINUE_GLOBAL_DIR;
      } else {
        process.env.CONTINUE_GLOBAL_DIR = originalContinueGlobalDir;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // Helper: call loadHooksConfig with isolated homeDir and project cwd
    function loadIsolated(cwd?: string) {
      return loadHooksConfig(cwd ?? projectDir, fakeHome);
    }

    it("returns empty config when no settings files exist", () => {
      const result = loadIsolated();
      expect(result.hooks).toEqual({});
      expect(result.disabled).toBe(false);
    });

    it("loads hooks from .continue/settings.json", () => {
      const settingsDir = path.join(projectDir, ".continue");
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(
        path.join(settingsDir, "settings.json"),
        JSON.stringify({
          hooks: {
            PreToolUse: [
              {
                matcher: "Bash",
                hooks: [{ type: "command", command: "echo test" }],
              },
            ],
          },
        }),
      );

      const result = loadIsolated();
      expect(result.hooks.PreToolUse).toHaveLength(1);
      expect(result.hooks.PreToolUse![0].matcher).toBe("Bash");
    });

    it("loads hooks from .claude/settings.json for cross-compatibility", () => {
      const settingsDir = path.join(projectDir, ".claude");
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(
        path.join(settingsDir, "settings.json"),
        JSON.stringify({
          hooks: {
            PostToolUse: [
              {
                hooks: [{ type: "command", command: "echo claude" }],
              },
            ],
          },
        }),
      );

      const result = loadIsolated();
      expect(result.hooks.PostToolUse).toHaveLength(1);
    });

    it("merges hooks from multiple settings files", () => {
      // .claude/settings.json (project-level)
      const claudeDir = path.join(projectDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(
        path.join(claudeDir, "settings.json"),
        JSON.stringify({
          hooks: {
            PreToolUse: [
              { hooks: [{ type: "command", command: "echo claude" }] },
            ],
          },
        }),
      );

      // .continue/settings.json (project-level)
      const continueDir = path.join(projectDir, ".continue");
      fs.mkdirSync(continueDir, { recursive: true });
      fs.writeFileSync(
        path.join(continueDir, "settings.json"),
        JSON.stringify({
          hooks: {
            PreToolUse: [
              { hooks: [{ type: "command", command: "echo continue" }] },
            ],
          },
        }),
      );

      const result = loadIsolated();
      // Both hooks should be merged (appended)
      expect(result.hooks.PreToolUse).toHaveLength(2);
    });

    it("respects disableAllHooks", () => {
      const settingsDir = path.join(projectDir, ".continue");
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(
        path.join(settingsDir, "settings.json"),
        JSON.stringify({
          disableAllHooks: true,
          hooks: {
            PreToolUse: [
              { hooks: [{ type: "command", command: "echo test" }] },
            ],
          },
        }),
      );

      const result = loadIsolated();
      expect(result.disabled).toBe(true);
      // Hooks are still loaded but won't be executed
      expect(result.hooks.PreToolUse).toHaveLength(1);
    });

    it("handles malformed settings files gracefully", () => {
      const settingsDir = path.join(projectDir, ".continue");
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(
        path.join(settingsDir, "settings.json"),
        "not valid json",
      );

      const result = loadIsolated();
      expect(result.hooks).toEqual({});
    });
  });
});

// ---------------------------------------------------------------------------
// hookRunner tests
// ---------------------------------------------------------------------------

// hookRunner tests spawn /bin/sh subprocesses — skip on Windows where cmd.exe
// has incompatible shell syntax (redirections, single-quote echo, sleep, etc.)
const describeUnix = process.platform === "win32" ? describe.skip : describe;

describeUnix("hookRunner", () => {
  describe("runHooks - command execution", () => {
    it("executes a simple command hook and returns stdout", async () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            hooks: [{ type: "command", command: 'echo "hello from hook"' }],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls" },
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      expect(result.blocked).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].stdout).toContain("hello from hook");
      expect(result.results[0].exitCode).toBe(0);
    });

    it("blocks when command exits with code 2", async () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: 'echo "blocked reason" >&2; exit 2',
              },
            ],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "rm -rf /" },
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      expect(result.blocked).toBe(true);
      expect(result.blockReason).toContain("blocked reason");
    });

    it("does not block on non-zero exit codes other than 2", async () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: "exit 1",
              },
            ],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      expect(result.blocked).toBe(false);
      expect(result.results[0].exitCode).toBe(1);
    });

    it("passes JSON input on stdin", async () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                // Read stdin and echo tool_name field
                command:
                  "cat | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d['tool_name'])\"",
              },
            ],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "MyTool",
        tool_input: {},
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      expect(result.results[0].stdout).toContain("MyTool");
    });

    it("parses JSON output from hook stdout", async () => {
      const jsonOutput = JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "dangerous operation",
        },
      });

      const config: HooksConfig = {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: `echo '${jsonOutput}'`,
              },
            ],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      expect(result.blocked).toBe(true);
      expect(result.permissionDecision).toBe("deny");
      expect(result.permissionDecisionReason).toBe("dangerous operation");
    });

    it("allows via PreToolUse hookSpecificOutput", async () => {
      const jsonOutput = JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
        },
      });

      const config: HooksConfig = {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: `echo '${jsonOutput}'`,
              },
            ],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      expect(result.blocked).toBe(false);
      expect(result.permissionDecision).toBe("allow");
    });

    it("blocks when JSON output has decision: 'block'", async () => {
      const jsonOutput = JSON.stringify({
        decision: "block",
        reason: "Blocked by policy",
      });

      const config: HooksConfig = {
        UserPromptSubmit: [
          {
            hooks: [
              {
                type: "command",
                command: `echo '${jsonOutput}'`,
              },
            ],
          },
        ],
      };

      const input: UserPromptSubmitInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "UserPromptSubmit",
        prompt: "delete everything",
      };

      const result = await runHooks(config, input);
      expect(result.blocked).toBe(true);
      expect(result.blockReason).toBe("Blocked by policy");
    });
  });

  describe("runHooks - matcher filtering", () => {
    it("only runs hooks that match the tool name", async () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            matcher: "^Bash$",
            hooks: [{ type: "command", command: "echo matched" }],
          },
          {
            matcher: "^Read$",
            hooks: [{ type: "command", command: "echo not-matched" }],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].stdout).toContain("matched");
    });

    it("runs all hooks for events without matchers (e.g., Stop)", async () => {
      const config: HooksConfig = {
        Stop: [
          {
            matcher: "ignored_for_stop",
            hooks: [{ type: "command", command: "echo stop1" }],
          },
          {
            hooks: [{ type: "command", command: "echo stop2" }],
          },
        ],
      };

      const input: StopInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "Stop",
        stop_hook_active: true,
      };

      const result = await runHooks(config, input);
      // Both groups should match because Stop is a no-matcher event
      expect(result.results).toHaveLength(2);
    });
  });

  describe("runHooks - deduplication", () => {
    it("deduplicates identical command hooks", async () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            hooks: [{ type: "command", command: "echo dedup" }],
          },
          {
            hooks: [{ type: "command", command: "echo dedup" }],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      // Should only run once despite appearing twice
      expect(result.results).toHaveLength(1);
    });

    it("does not deduplicate different commands", async () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            hooks: [
              { type: "command", command: "echo first" },
              { type: "command", command: "echo second" },
            ],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      expect(result.results).toHaveLength(2);
    });
  });

  describe("runHooks - additionalContext", () => {
    it("collects stdout as additionalContext for UserPromptSubmit on exit 0", async () => {
      const config: HooksConfig = {
        UserPromptSubmit: [
          {
            hooks: [{ type: "command", command: "echo 'extra context'" }],
          },
        ],
      };

      const input: UserPromptSubmitInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "UserPromptSubmit",
        prompt: "hello",
      };

      const result = await runHooks(config, input);
      expect(result.blocked).toBe(false);
      expect(result.additionalContext).toContain("extra context");
    });

    it("collects stdout as additionalContext for SessionStart on exit 0", async () => {
      const config: HooksConfig = {
        SessionStart: [
          {
            hooks: [{ type: "command", command: "echo 'session info'" }],
          },
        ],
      };

      const input: SessionStartInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "SessionStart",
        source: "startup",
      };

      const result = await runHooks(config, input);
      expect(result.additionalContext).toContain("session info");
    });

    it("collects additionalContext from hookSpecificOutput", async () => {
      const jsonOutput = JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: "Tool completed successfully with changes",
        },
      });

      const config: HooksConfig = {
        PostToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: `echo '${jsonOutput}'`,
              },
            ],
          },
        ],
      };

      const input = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PostToolUse" as const,
        tool_name: "Bash",
        tool_input: {},
        tool_response: "ok",
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      expect(result.additionalContext).toContain(
        "Tool completed successfully with changes",
      );
    });
  });

  describe("runHooks - async hooks", () => {
    it("fires async hooks without blocking", async () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: "sleep 10", // Long-running async hook
                async: true,
              },
              {
                type: "command",
                command: "echo sync-hook",
                // sync (default)
              },
            ],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "test-id",
      };

      const start = Date.now();
      const result = await runHooks(config, input);
      const elapsed = Date.now() - start;

      // Should complete quickly (not wait for the 10s sleep)
      expect(elapsed).toBeLessThan(5000);
      // Only sync hook result should be in results
      expect(result.results).toHaveLength(1);
      expect(result.results[0].stdout).toContain("sync-hook");
    });
  });

  describe("runHooks - prompt/agent types", () => {
    it("returns no-op for prompt hook type", async () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            hooks: [
              {
                type: "prompt",
                prompt: "Is this safe?",
              },
            ],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      expect(result.blocked).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].exitCode).toBe(0);
    });
  });

  describe("runHooks - no matching hooks", () => {
    it("returns empty result when no hooks configured for event", async () => {
      const config: HooksConfig = {};

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      expect(result.blocked).toBe(false);
      expect(result.results).toHaveLength(0);
    });

    it("returns empty result when matcher does not match", async () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            matcher: "^NonExistentTool$",
            hooks: [{ type: "command", command: "echo should-not-run" }],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input);
      expect(result.blocked).toBe(false);
      expect(result.results).toHaveLength(0);
    });
  });

  describe("runHooks - environment variables", () => {
    it("sets CONTINUE_PROJECT_DIR and CLAUDE_PROJECT_DIR env vars", async () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: 'echo "$CONTINUE_PROJECT_DIR|$CLAUDE_PROJECT_DIR"',
              },
            ],
          },
        ],
      };

      const testCwd = process.cwd();
      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: testCwd,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "test-id",
      };

      const result = await runHooks(config, input, testCwd);
      expect(result.results[0].stdout).toContain(testCwd);
      // Both vars should be set to the same cwd
      expect(result.results[0].stdout).toBe(`${testCwd}|${testCwd}`);
    });
  });

  describe("runHooks - error handling", () => {
    it("handles command not found gracefully", async () => {
      const config: HooksConfig = {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: "this_command_does_not_exist_12345",
              },
            ],
          },
        ],
      };

      const input: PreToolUseInput = {
        session_id: "test-session",
        transcript_path: "",
        cwd: process.cwd(),
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {},
        tool_use_id: "test-id",
      };

      // Should not throw
      const result = await runHooks(config, input);
      expect(result.blocked).toBe(false);
      // Exit code should be non-zero (127 for command not found)
      expect(result.results[0].exitCode).not.toBe(0);
    });
  });
});
