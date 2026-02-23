import { decodePackageIdentifier } from "@continuedev/config-yaml";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isStringRule } from "src/hubLoader.js";

import { BaseCommandOptions } from "../commands/BaseCommandOptions.js";
import { ConfigService } from "../services/ConfigService.js";

// Mock the required functions - need to match the import path used by ConfigService
vi.mock("src/hubLoader.js", () => ({
  isStringRule: vi.fn(),
}));

vi.mock("@continuedev/config-yaml", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@continuedev/config-yaml")>()),
  decodePackageIdentifier: vi.fn((id) => ({
    type: "slug" as const,
    slug: id,
    version: undefined,
  })),
}));

vi.mock("../configLoader.js", () => ({
  loadConfiguration: vi.fn(),
}));

vi.mock("../auth/workos.js", () => ({
  loadAuthConfig: vi.fn(),
}));

vi.mock("../util/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Rule duplication integration test", () => {
  let configService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    configService = new ConfigService();

    // Reset mocks to their default behavior
    vi.mocked(decodePackageIdentifier).mockImplementation((id) => ({
      uriType: "slug",
      fullSlug: {
        ownerSlug: "owner",
        packageSlug: "package",
        versionSlug: "version",
      },
    }));

    // Reset isStringRule mock
    vi.mocked(isStringRule).mockImplementation((rule: string) => {
      // Default implementation - string rules contain spaces/newlines or are local paths
      return (
        rule.includes(" ") ||
        rule.includes("\n") ||
        rule.startsWith(".") ||
        rule.startsWith("/") ||
        !rule.includes("/")
      );
    });
  });

  it("should not duplicate rules when using --rule flag", () => {
    // Setup mocks
    vi.mocked(isStringRule).mockReturnValue(false); // "nate/spanish" is a package identifier

    // Simulate command-line options with --rule flag
    const options: BaseCommandOptions = {
      rule: ["nate/spanish"],
    };

    // Process the options through the config service
    const { injected, additional } =
      configService.getAdditionalBlocksFromOptions(options, undefined);

    // The rule should be processed as a package identifier
    expect(vi.mocked(decodePackageIdentifier)).toHaveBeenCalledWith(
      "nate/spanish",
    );
    expect(injected).toHaveLength(1);
    expect(additional.rules).toHaveLength(0); // Package identifier rules go into injected
  });

  it("should merge command-line rules with existing config rules", () => {
    // Setup mocks for different rule types
    vi.mocked(isStringRule)
      .mockReturnValueOnce(false) // "nate/spanish" is a package identifier
      .mockReturnValueOnce(true); // "direct-rule" is a string rule

    // Simulate command-line options with --rule flag
    const options: BaseCommandOptions = {
      rule: ["nate/spanish", "direct-rule"],
    };

    // Process the options through the config service
    const { injected, additional } =
      configService.getAdditionalBlocksFromOptions(options, undefined);

    // "nate/spanish" should be a package identifier, "direct-rule" should be a string rule
    expect(vi.mocked(decodePackageIdentifier)).toHaveBeenCalledWith(
      "nate/spanish",
    );
    expect(injected).toHaveLength(1); // nate/spanish
    expect(additional.rules).toEqual(["direct-rule"]); // direct-rule as string
  });

  it("should process package identifiers for hub rules", () => {
    // Setup mock - all rules are package identifiers
    vi.mocked(isStringRule).mockReturnValue(false);

    const options: BaseCommandOptions = {
      rule: ["nate/spanish"],
    };

    const { injected, additional } =
      configService.getAdditionalBlocksFromOptions(options, undefined);

    // Hub rules should be processed as package identifiers, not string rules
    expect(vi.mocked(decodePackageIdentifier)).toHaveBeenCalledWith(
      "nate/spanish",
    );
    expect(injected).toHaveLength(1);
    expect(additional.rules).toHaveLength(0); // Package identifier rules don't go into additional.rules
  });
});
