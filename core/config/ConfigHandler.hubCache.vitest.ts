import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("ConfigHandler hub assistant cache fallback", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "continue-hub-cache-"));
    process.env.CONTINUE_GLOBAL_DIR = path.join(tempDir, ".continue-global");
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.CONTINUE_GLOBAL_DIR;
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  test("uses cached hub assistants when the hub becomes unavailable", async () => {
    const [{ ConfigHandler }, { LLMLogger }, { default: FileSystemIde }] =
      await Promise.all([
        import("./ConfigHandler"),
        import("../llm/logger"),
        import("../util/filesystem"),
      ]);

    class TestIde extends FileSystemIde {
      override async fileExists(fileUri: string): Promise<boolean> {
        const filepath = fileUri.startsWith("file://")
          ? fileURLToPath(fileUri)
          : fileUri;
        return fs.existsSync(filepath);
      }
    }

    const ide = new TestIde(tempDir);
    const handler = new ConfigHandler(
      ide,
      new LLMLogger(),
      Promise.resolve(undefined),
    );
    await handler.isInitialized;

    const personalAssistant = {
      configResult: {
        config: {
          name: "Local LlamaCpp",
          version: "1.0.0",
        },
        configLoadInterrupted: false,
        errors: [],
      },
      iconUrl: "https://example.com/personal.png",
      ownerSlug: "lemonade",
      packageSlug: "llamacpp",
      rawYaml: "name: Local LlamaCpp",
    };
    const orgAssistant = {
      configResult: {
        config: {
          name: "Org Assistant",
          version: "2.0.0",
        },
        configLoadInterrupted: false,
        errors: [],
      },
      iconUrl: "https://example.com/org.png",
      ownerSlug: "continuedev",
      packageSlug: "team-assistant",
      rawYaml: "name: Org Assistant",
    };

    let outage = false;
    (handler as any).controlPlaneClient = {
      getPolicy: vi.fn().mockResolvedValue(null),
      isSignedIn: vi.fn().mockResolvedValue(true),
      listOrganizations: vi.fn().mockImplementation(async () => {
        if (outage) {
          return null;
        }

        return [
          {
            iconUrl: "https://example.com/org.png",
            id: "org-1",
            name: "Org One",
            slug: "org-one",
          },
        ];
      }),
      listAssistants: vi
        .fn()
        .mockImplementation(async (orgId: string | null) => {
          if (outage) {
            return null;
          }

          return orgId === null ? [personalAssistant] : [orgAssistant];
        }),
    };

    const warm = await (handler as any).getOrgs();
    expect(warm.errors ?? []).toHaveLength(0);

    outage = true;

    const fallback = await (handler as any).getOrgs();
    expect(fallback.errors?.map((error: any) => error.message)).toContain(
      "Continue Hub is unavailable. Using cached Hub assistants until the service recovers.",
    );

    const personalOrg = fallback.orgs.find((org: any) => org.id === "personal");
    expect(
      personalOrg?.profiles.some(
        (profile: any) =>
          profile.profileDescription.id === "lemonade/llamacpp" &&
          profile.profileDescription.title === "Local LlamaCpp",
      ),
    ).toBe(true);

    const org = fallback.orgs.find((entry: any) => entry.id === "org-1");
    expect(
      org?.profiles.some(
        (profile: any) =>
          profile.profileDescription.id === "continuedev/team-assistant" &&
          profile.profileDescription.title === "Org Assistant",
      ),
    ).toBe(true);
  });
});
