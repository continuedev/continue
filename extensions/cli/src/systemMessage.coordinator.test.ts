import { describe, expect, it, vi } from "vitest";

vi.unmock("./systemMessage.js");

vi.mock("./services/ServiceContainer.js", () => ({
  serviceContainer: {
    get: vi.fn().mockResolvedValue({ config: { rules: [] } }),
    set: vi.fn(),
  },
}));

vi.mock("./hubLoader.js", () => ({
  processRule: vi
    .fn()
    .mockImplementation((spec: string) => Promise.resolve(spec)),
}));

vi.mock("./util/loadMarkdownSkills.js", () => ({
  loadMarkdownSkills: vi.fn().mockResolvedValue({
    skills: [
      {
        name: "Repo Recon",
        description: "Map a codepath before editing.",
        content: "Skill body",
        path: "./.yutoagentic/skills/repo-recon/SKILL.md",
        files: [],
        whenToUse: "Use for focused repository discovery",
        context: "fork",
        agent: "Explore",
        allowedTools: ["Read", "Grep"],
        paths: ["src/**"],
        userInvocable: true,
      },
    ],
    errors: [],
  }),
}));

const { constructSystemMessage } = await import("./systemMessage.js");

describe("constructSystemMessage coordinator mode", () => {
  it("includes coordinator orchestration guidance and worker-capable skill metadata", async () => {
    const result = await constructSystemMessage("coordinator");

    expect(result).toContain("You are operating in _Coordinator Mode_");
    expect(result).toContain("`coordinator-worker` profile");
    expect(result).toContain("shared worker scratchpad");
    expect(result).toContain("Available worker-capable skills:");
    expect(result).toContain("Repo Recon");
    expect(result).toContain("context=fork");
    expect(result).toContain("allowedTools=Read, Grep");
  });
});
