import { isContinueTeamMember } from "./isContinueTeamMember";

describe("isContinueTeamMember", () => {
  describe("returns true for Continue team members", () => {
    it("should return true for email with @continue.dev domain", () => {
      expect(isContinueTeamMember("user@continue.dev")).toBe(true);
    });

    it("should return true for any username at @continue.dev", () => {
      expect(isContinueTeamMember("john.doe@continue.dev")).toBe(true);
      expect(isContinueTeamMember("jane@continue.dev")).toBe(true);
      expect(isContinueTeamMember("test.user.123@continue.dev")).toBe(true);
    });
  });

  describe("returns false for non-Continue team members", () => {
    it("should return false for non-continue.dev domain", () => {
      expect(isContinueTeamMember("user@gmail.com")).toBe(false);
    });

    it("should return false for similar but different domains", () => {
      expect(isContinueTeamMember("user@notcontinue.dev")).toBe(false);
      expect(isContinueTeamMember("user@continue.com")).toBe(false);
      expect(isContinueTeamMember("user@continue.io")).toBe(false);
    });

    it("should return false for domain containing continue.dev as substring", () => {
      expect(isContinueTeamMember("user@fakecontinue.dev.com")).toBe(false);
    });
  });

  describe("handles edge cases", () => {
    it("should return false for undefined email", () => {
      expect(isContinueTeamMember(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isContinueTeamMember("")).toBe(false);
    });

    it("should return true when @continue.dev appears anywhere in the string", () => {
      // Note: This tests the current implementation behavior
      // The function uses includes(), so it matches anywhere in the string
      expect(isContinueTeamMember("prefix@continue.dev")).toBe(true);
    });
  });
});
