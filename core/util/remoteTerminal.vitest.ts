import { describe, expect, it } from "vitest";
import {
  isLocalIde,
  MAX_CAPTURE_FAILURES_BEFORE_DISABLE,
  nextCaptureFailureCount,
  OUTPUT_CAPTURE_CAPABLE_REMOTES,
  remoteCommandStatus,
  remoteOutputUnavailableMessage,
  SHELL_INTEGRATION_MISSING_MARKER,
  SHELL_INTEGRATION_MISSING_MESSAGE,
  shouldAttemptCapture,
  supportsRemoteTerminalOutput,
} from "./remoteTerminal";

describe("supportsRemoteTerminalOutput", () => {
  it("returns true for every documented capture-capable remote", () => {
    for (const remote of OUTPUT_CAPTURE_CAPABLE_REMOTES) {
      expect(supportsRemoteTerminalOutput(remote)).toBe(true);
    }
  });

  it("returns true for ssh-remote (the Remote-SSH case this patch adds)", () => {
    expect(supportsRemoteTerminalOutput("ssh-remote")).toBe(true);
  });

  it("still returns true for wsl (no regression on the existing patch)", () => {
    expect(supportsRemoteTerminalOutput("wsl")).toBe(true);
  });

  it("returns false for local — those go through childProcess.spawn", () => {
    expect(supportsRemoteTerminalOutput("")).toBe(false);
    expect(supportsRemoteTerminalOutput("local")).toBe(false);
  });

  it("returns false for unknown / third-party remotes", () => {
    expect(supportsRemoteTerminalOutput("some-unsupported-remote")).toBe(false);
    expect(supportsRemoteTerminalOutput("ssh")).toBe(false); // must be exact "ssh-remote"
    expect(supportsRemoteTerminalOutput("WSL")).toBe(false); // case sensitive
    expect(supportsRemoteTerminalOutput(" wsl")).toBe(false); // no trimming
  });

  it("returns false for undefined and null-ish input", () => {
    expect(supportsRemoteTerminalOutput(undefined)).toBe(false);
    expect(supportsRemoteTerminalOutput(undefined as unknown as string)).toBe(
      false,
    );
  });
});

describe("isLocalIde", () => {
  it("treats empty string and 'local' as local", () => {
    expect(isLocalIde("")).toBe(true);
    expect(isLocalIde("local")).toBe(true);
  });

  it("treats undefined as local (vscode.env.remoteName is undefined locally)", () => {
    expect(isLocalIde(undefined)).toBe(true);
  });

  it("treats every remote as non-local", () => {
    for (const remote of OUTPUT_CAPTURE_CAPABLE_REMOTES) {
      expect(isLocalIde(remote)).toBe(false);
    }
    expect(isLocalIde("anything-else")).toBe(false);
  });

  it("is disjoint from supportsRemoteTerminalOutput", () => {
    // No value should be both local and capture-capable — the two branches in
    // runTerminalCommandImpl must never both match.
    const candidates = [
      undefined,
      "",
      "local",
      ...OUTPUT_CAPTURE_CAPABLE_REMOTES,
      "unknown-remote",
    ];
    for (const candidate of candidates) {
      const local = isLocalIde(candidate);
      const capturable = supportsRemoteTerminalOutput(candidate);
      expect(local && capturable).toBe(false);
    }
  });
});

describe("shouldAttemptCapture", () => {
  it("always attempts when the last attempt succeeded", () => {
    expect(shouldAttemptCapture(0, true)).toBe(true);
    expect(shouldAttemptCapture(99, true)).toBe(true);
  });

  it("attempts while under the failure budget", () => {
    for (let i = 0; i < MAX_CAPTURE_FAILURES_BEFORE_DISABLE; i++) {
      expect(shouldAttemptCapture(i, false)).toBe(true);
    }
  });

  it("stops attempting once the failure budget is exhausted", () => {
    expect(
      shouldAttemptCapture(MAX_CAPTURE_FAILURES_BEFORE_DISABLE, false),
    ).toBe(false);
    expect(
      shouldAttemptCapture(MAX_CAPTURE_FAILURES_BEFORE_DISABLE + 1, false),
    ).toBe(false);
  });

  it("has a non-zero budget so a single flaky command does not disable capture", () => {
    expect(MAX_CAPTURE_FAILURES_BEFORE_DISABLE).toBeGreaterThan(1);
  });
});

describe("nextCaptureFailureCount", () => {
  it("resets to zero on success", () => {
    expect(nextCaptureFailureCount(0, true)).toBe(0);
    expect(nextCaptureFailureCount(1, true)).toBe(0);
    expect(nextCaptureFailureCount(17, true)).toBe(0);
  });

  it("increments on failure", () => {
    expect(nextCaptureFailureCount(0, false)).toBe(1);
    expect(nextCaptureFailureCount(1, false)).toBe(2);
  });

  it("never returns a negative count for a negative input", () => {
    expect(nextCaptureFailureCount(-5, false)).toBe(1);
    expect(nextCaptureFailureCount(-5, true)).toBe(0);
  });

  it("drives shouldAttemptCapture to the documented cutoff", () => {
    let failures = 0;
    let attempts = 0;
    // Simulate a permanently-broken remote.
    for (let i = 0; i < 10; i++) {
      if (!shouldAttemptCapture(failures, false)) {
        break;
      }
      attempts++;
      failures = nextCaptureFailureCount(failures, false);
    }
    expect(attempts).toBe(MAX_CAPTURE_FAILURES_BEFORE_DISABLE);
  });

  it("re-enables capture after an interleaved success", () => {
    let failures = nextCaptureFailureCount(0, false);
    failures = nextCaptureFailureCount(failures, false);
    expect(shouldAttemptCapture(failures, false)).toBe(false);
    // A success resets the budget.
    failures = nextCaptureFailureCount(failures, true);
    expect(shouldAttemptCapture(failures, false)).toBe(true);
  });
});

describe("remoteCommandStatus", () => {
  it("reports success for exit code 0", () => {
    expect(remoteCommandStatus(0)).toBe("Command completed");
  });

  it("reports success for unknown exit code (null)", () => {
    expect(remoteCommandStatus(null)).toBe("Command completed");
  });

  it("reports the exit code for failures", () => {
    expect(remoteCommandStatus(1)).toBe("Command exited with code 1");
    expect(remoteCommandStatus(127)).toBe("Command exited with code 127");
    expect(remoteCommandStatus(130)).toBe("Command exited with code 130");
  });

  it("does not treat a non-zero code as success", () => {
    expect(remoteCommandStatus(1)).not.toBe("Command completed");
  });
});

describe("remoteOutputUnavailableMessage", () => {
  it("names the unsupported remote so the model knows the scope", () => {
    const msg = remoteOutputUnavailableMessage("some-unsupported-remote");
    expect(msg).toContain("some-unsupported-remote");
    expect(msg).toContain("Command executed in remote terminal");
  });

  it("handles undefined remote without producing 'undefined' text", () => {
    const msg = remoteOutputUnavailableMessage(undefined);
    expect(msg).toContain("unknown");
    expect(msg).not.toContain("undefined");
  });

  it("explains the capture-failure case differently from the unsupported case", () => {
    const capable = remoteOutputUnavailableMessage("ssh-remote");
    const incapable = remoteOutputUnavailableMessage("weird-remote");
    expect(capable).toContain("capture was attempted but failed");
    expect(incapable).toContain("not yet available");
    expect(capable).not.toBe(incapable);
  });

  it("always tells the user where to find the output", () => {
    for (const remote of ["ssh-remote", "wsl", "weird-remote", undefined]) {
      expect(remoteOutputUnavailableMessage(remote)).toContain("terminal panel");
    }
  });
});

describe("SHELL_INTEGRATION_MISSING_MESSAGE", () => {
  it("mentions shell integration and how to enable it", () => {
    expect(SHELL_INTEGRATION_MISSING_MESSAGE).toContain("shell integration");
    expect(SHELL_INTEGRATION_MISSING_MESSAGE).toContain(
      "terminal.integrated.shellIntegration.enabled",
    );
  });

  it("is non-empty", () => {
    expect(SHELL_INTEGRATION_MISSING_MESSAGE.trim().length).toBeGreaterThan(
      40,
    );
  });

  it("embeds the machine-readable marker used by the tool implementation", () => {
    expect(SHELL_INTEGRATION_MISSING_MESSAGE).toContain(
      SHELL_INTEGRATION_MISSING_MARKER,
    );
  });
});

describe("SHELL_INTEGRATION_MISSING_MARKER", () => {
  it("is a short bracketed token unlikely to appear in real command output", () => {
    expect(SHELL_INTEGRATION_MISSING_MARKER.startsWith("[")).toBe(true);
    expect(SHELL_INTEGRATION_MISSING_MARKER.endsWith("]")).toBe(true);
    expect(SHELL_INTEGRATION_MISSING_MARKER.length).toBeLessThan(60);
  });

  it("does not appear in the other user-facing messages", () => {
    // Otherwise the failure counter would misfire on unsupported remotes.
    expect(
      remoteOutputUnavailableMessage("ssh-remote").includes(
        SHELL_INTEGRATION_MISSING_MARKER,
      ),
    ).toBe(false);
    expect(
      remoteOutputUnavailableMessage("weird-remote").includes(
        SHELL_INTEGRATION_MISSING_MARKER,
      ),
    ).toBe(false);
    expect(remoteCommandStatus(0)).not.toContain(
      SHELL_INTEGRATION_MISSING_MARKER,
    );
  });
});
