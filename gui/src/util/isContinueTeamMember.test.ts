import { describe, expect, it } from "vitest";
import { isContinueTeamMember } from "./isContinueTeamMember";

describe("isContinueTeamMember", () => {
  it("should return true for @continue.dev email addresses", () => {
    expect(isContinueTeamMember("test@continue.dev")).toBe(true);
    expect(isContinueTeamMember("user.name@continue.dev")).toBe(true);
    expect(isContinueTeamMember("team+label@continue.dev")).toBe(true);
  });

  it("should return false for non-continue.dev email addresses", () => {
    expect(isContinueTeamMember("test@gmail.com")).toBe(false);
    expect(isContinueTeamMember("user@company.com")).toBe(false);
    expect(isContinueTeamMember("test@continue.io")).toBe(false);
    expect(isContinueTeamMember("test@notcontinue.dev")).toBe(false);
  });

  it("should return false for undefined email", () => {
    expect(isContinueTeamMember(undefined)).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isContinueTeamMember("")).toBe(false);
  });

  it("should return false for subdomain email addresses", () => {
    // Subdomains are not considered team members
    expect(isContinueTeamMember("test@sub.continue.dev")).toBe(false);
  });
});
