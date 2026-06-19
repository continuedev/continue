import { afterEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateWriteStream,
  mockEnd,
  mockGetPromptLogsPath,
  mockLLMLogFormatter,
} = vi.hoisted(() => ({
  mockEnd: vi.fn(),
  mockCreateWriteStream: vi.fn(() => ({
    end: vi.fn(),
  })),
  mockGetPromptLogsPath: vi.fn(() => "/tmp/prompt.log"),
  mockLLMLogFormatter: vi.fn(),
}));

mockCreateWriteStream.mockImplementation(() => ({
  end: mockEnd,
}));

vi.mock("node:fs", () => ({
  __esModule: true,
  default: {
    createWriteStream: mockCreateWriteStream,
  },
}));

vi.mock("core/util/paths", () => ({
  getPromptLogsPath: mockGetPromptLogsPath,
}));

vi.mock("core/llm/logFormatter", () => ({
  LLMLogFormatter: mockLLMLogFormatter,
}));

import { setupPromptLogging } from "./setupPromptLogging";

describe("setupPromptLogging", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockCreateWriteStream.mockImplementation(() => ({
      end: mockEnd,
    }));
  });

  it("creates a prompt log stream and closes it on dispose", () => {
    const llmLogger = {} as any;

    const disposable = setupPromptLogging(llmLogger);

    expect(mockGetPromptLogsPath).toHaveBeenCalledTimes(1);
    expect(mockCreateWriteStream).toHaveBeenCalledWith("/tmp/prompt.log");
    expect(mockLLMLogFormatter).toHaveBeenCalledWith(
      llmLogger,
      expect.objectContaining({ end: mockEnd }),
    );

    disposable.dispose();

    expect(mockEnd).toHaveBeenCalledTimes(1);
  });
});
