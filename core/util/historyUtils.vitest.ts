import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shareSession } from "./historyUtils";

describe("shareSession", () => {
  const originalTz = process.env.TZ;
  let outputDir: string;

  const shareAt = async (timeZone: string, isoTime: string) => {
    process.env.TZ = timeZone;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(isoTime));

    const ide = { writeFile: vi.fn(), openFile: vi.fn() };
    const fileUrl = await shareSession(ide as any, [], outputDir);
    return path.basename(fileUrl);
  };

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "continue-share-"));
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it("names the file after local time in whole-hour timezones", async () => {
    // UTC-04:00 in August
    const name = await shareAt("America/New_York", "2026-08-17T10:00:00.000Z");
    expect(name).toBe("20260817T060000_session.md");
  });

  it("names the file after local time in half-hour timezones", async () => {
    // UTC+05:30
    const name = await shareAt("Asia/Kolkata", "2026-08-17T10:00:00.000Z");
    expect(name).toBe("20260817T153000_session.md");
  });

  it("names the file after local time in quarter-hour timezones", async () => {
    // UTC+05:45
    const name = await shareAt("Asia/Kathmandu", "2026-08-17T10:00:00.000Z");
    expect(name).toBe("20260817T154500_session.md");
  });
});
