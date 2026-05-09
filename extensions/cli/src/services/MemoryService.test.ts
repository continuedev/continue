import fsPromises from "fs/promises";
import os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MemoryService } from "./MemoryService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { SERVICE_NAMES } from "./types.js";

async function writeMemoryFile(
  rootDir: string,
  relativePath: string,
  content: string,
): Promise<string> {
  const filePath = path.join(rootDir, relativePath);
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.writeFile(filePath, content, "utf8");
  return filePath;
}

describe("MemoryService", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fsPromises.mkdtemp(
      path.join(os.tmpdir(), "memory-service-"),
    );
    serviceContainer.registerValue(SERVICE_NAMES.FEATURE_FLAGS, {
      flags: {
        SEMANTIC_MEMORY_SELECTION: false,
      },
      lastFetched: null,
      remoteConfigUrl: null,
    });
    serviceContainer.registerValue(SERVICE_NAMES.MODEL, {
      llmApi: null,
      model: null,
      assistant: null,
      authConfig: null,
    });
  });

  afterEach(async () => {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  });

  it("scans nested frontmatter-aware memories and ignores legacy MEMORY.md", async () => {
    await writeMemoryFile(
      tempDir,
      "MEMORY.md",
      "# Legacy memory\nThis file should be ignored by memdir scanning.\n",
    );
    await writeMemoryFile(
      tempDir,
      "decisions/api-guardrails.md",
      `---
name: API Guardrails
description: Auth rate limit notes
type: decision
---
# API Guardrails
Use the existing burst-limit middleware for auth endpoints.
`,
    );
    await writeMemoryFile(
      tempDir,
      "notes/release-checklist.txt",
      "Release checklist memory\n",
    );

    const service = new MemoryService();
    await service.initialize({ memoryDir: tempDir });

    expect(
      service
        .listMemories()
        .map((entry) => entry.name)
        .sort(),
    ).toEqual(["API Guardrails", "notes/release-checklist"]);

    const relevant = await service.findRelevantMemories(
      "auth rate limit decision",
    );
    expect(relevant[0]).toMatchObject({
      name: "API Guardrails",
      filename: "decisions/api-guardrails.md",
      description: "Auth rate limit notes",
      type: "decision",
    });
  });

  it("filters already surfaced memories and formats matching memories for injection", async () => {
    const shellLimitsPath = await writeMemoryFile(
      tempDir,
      "warnings/shell-limits.md",
      `---
name: Shell Limits
description: Prefer read-only shell probes
type: warning
---
# Shell Limits
Use rg, git status, and diff-style commands before delegating writes.
`,
    );
    await writeMemoryFile(
      tempDir,
      "decisions/api-guardrails.md",
      `---
name: API Guardrails
description: Auth rate limit notes
type: decision
---
# API Guardrails
Use the existing burst-limit middleware for auth endpoints.
`,
    );

    const service = new MemoryService();
    await service.initialize({ memoryDir: tempDir });

    const relevant = await service.findRelevantMemories("shell probes warning");
    expect(relevant[0]?.filePath).toBe(shellLimitsPath);

    const filtered = await service.findRelevantMemories(
      "shell probes warning",
      new Set([shellLimitsPath]),
    );
    expect(
      filtered.every((memory) => memory.filePath !== shellLimitsPath),
    ).toBe(true);

    const formatted = await service.formatMemoriesForSystemMessage(
      "shell probes warning",
    );
    expect(formatted).toContain("# Relevant Memories");
    expect(formatted).toContain(
      "### Memory: Shell Limits (warning) - Prefer read-only shell probes",
    );
    expect(formatted).toContain("Use rg, git status, and diff-style commands");
  });

  it("truncates oversized memory content before injection", async () => {
    const longMarkdown = Array.from(
      { length: 205 },
      (_, index) => `line ${index + 1}`,
    ).join("\n");

    await writeMemoryFile(
      tempDir,
      "notes/truncation-check.md",
      `---
name: Truncation Check
description: truncation test memory
type: note
---
${longMarkdown}
`,
    );

    const service = new MemoryService();
    await service.initialize({ memoryDir: tempDir });

    const [memory] = await service.findRelevantMemories(
      "truncation test memory",
    );

    expect(memory.name).toBe("Truncation Check");
    expect(memory.content).toContain(
      "<!-- truncated: exceeded 200-line limit -->",
    );
    expect(memory.content).toContain("line 200");
    expect(memory.content).not.toContain("line 205");
  });
});
