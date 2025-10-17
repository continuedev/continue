import * as os from "os";
import * as path from "path";
import { normalizeDisplayPath } from "./pathResolver";

describe("normalizeDisplayPath", () => {
  it("should contract home directory to ~", () => {
    const homedir = os.homedir();

    expect(
      normalizeDisplayPath(path.join(homedir, "Documents", "file.txt")),
    ).toBe("~/Documents/file.txt");

    expect(normalizeDisplayPath("/usr/local/bin")).toBe("/usr/local/bin");
  });

  it("should handle root home directory", () => {
    const homedir = os.homedir();
    expect(normalizeDisplayPath(homedir)).toBe("~");
  });

  it("should not contract paths that aren't under home", () => {
    expect(normalizeDisplayPath("/var/log/messages")).toBe("/var/log/messages");
    expect(normalizeDisplayPath("/usr/local/bin")).toBe("/usr/local/bin");
  });
});
