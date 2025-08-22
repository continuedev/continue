import * as readline from "readline";

import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
  MockInstance,
} from "vitest";

// Mock readline module
vi.mock("readline", () => ({
  createInterface: vi.fn(),
}));

import { question, questionWithChoices } from "./prompt.js";

describe("prompt utilities", () => {
  let mockInterface: any;
  let consoleLogSpy: MockInstance<typeof console.log>;
  let processExitSpy: MockInstance<typeof process.exit>;

  beforeEach(() => {
    // Create a mock readline interface
    mockInterface = {
      question: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };

    // Mock readline.createInterface to return our mock interface
    (readline.createInterface as any).mockReturnValue(mockInterface);

    // Mock console.log for limit messages
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock process.exit
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("Process exit");
    }) as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("question", () => {
    it("should return user input", async () => {
      const promptText = "What is your name? ";
      const userInput = "John Doe";

      // Setup mock to call the callback with user input
      mockInterface.question.mockImplementation(
        (prompt: string, callback: (answer: string) => void) => {
          setTimeout(() => callback(userInput), 0);
        },
      );

      const result = await question(promptText);

      expect(mockInterface.question).toHaveBeenCalledWith(
        promptText,
        expect.any(Function),
      );
      expect(mockInterface.close).toHaveBeenCalled();
      expect(result).toBe(userInput);
    });

    it("should handle empty input", async () => {
      const promptText = "Enter something: ";

      mockInterface.question.mockImplementation(
        (prompt: string, callback: (answer: string) => void) => {
          setTimeout(() => callback(""), 0);
        },
      );

      const result = await question(promptText);

      expect(result).toBe("");
    });

    it("should handle special characters in input", async () => {
      const promptText = "Enter special chars: ";
      const userInput = "!@#$%^&*()_+-=[]{}|;':\",./<>?";

      mockInterface.question.mockImplementation(
        (prompt: string, callback: (answer: string) => void) => {
          setTimeout(() => callback(userInput), 0);
        },
      );

      const result = await question(promptText);

      expect(result).toBe(userInput);
    });

    it.skip("should handle SIGINT (Ctrl+C) by exiting process", async () => {
      const promptText = "Enter something: ";
      let sigintHandler: (() => void) | null = null;

      // Setup mock to capture SIGINT handler
      mockInterface.on.mockImplementation(
        (event: string, handler: () => void) => {
          if (event === "SIGINT") {
            sigintHandler = handler;
          }
          return mockInterface;
        },
      );

      // Setup question mock that doesn't resolve immediately
      mockInterface.question.mockImplementation(() => {
        // Trigger SIGINT after question is called
        setTimeout(() => {
          if (sigintHandler) {
            sigintHandler();
          }
        }, 10);
      });

      // The promise should reject when SIGINT is triggered
      await expect(question(promptText)).rejects.toThrow("Process exit");
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("questionWithChoices", () => {
    it("should accept valid choice", async () => {
      const promptText = "Choose (1): ";
      const choices = ["1", "2", "3"];
      const userChoice = "2";

      mockInterface.question.mockImplementationOnce(
        (prompt: string, callback: (answer: string) => void) => {
          setTimeout(() => callback(userChoice), 0);
        },
      );

      const result = await questionWithChoices(promptText, choices);
      expect(result).toBe(userChoice);
    });

    it("should use default choice when empty input is provided", async () => {
      const promptText = "Choose (1): ";
      const choices = ["1", "2", "3"];
      const defaultChoice = "1";

      mockInterface.question.mockImplementationOnce(
        (prompt: string, callback: (answer: string) => void) => {
          setTimeout(() => callback(""), 0);
        },
      );

      const result = await questionWithChoices(
        promptText,
        choices,
        defaultChoice,
      );
      expect(result).toBe(defaultChoice);
    });

    it("should reject invalid choice and ask again", async () => {
      const promptText = "Choose (1 or 2): ";
      const choices = ["1", "2"];
      const limitMessage = "Please enter 1 or 2";

      let callCount = 0;
      mockInterface.question.mockImplementation(
        (prompt: string, callback: (answer: string) => void) => {
          setTimeout(() => {
            if (callCount === 0) {
              callCount++;
              callback("3"); // Invalid choice
            } else {
              callback("1"); // Valid choice
            }
          }, 0);
        },
      );

      const result = await questionWithChoices(
        promptText,
        choices,
        undefined,
        limitMessage,
      );
      expect(result).toBe("1");
      expect(consoleLogSpy).toHaveBeenCalledWith(limitMessage);
    });

    it("should handle multiple invalid attempts before valid choice", async () => {
      const promptText = "Choose: ";
      const choices = ["yes", "no"];
      const limitMessage = "Invalid choice";

      let callCount = 0;
      const invalidAnswers = ["maybe", "perhaps"];
      mockInterface.question.mockImplementation(
        (prompt: string, callback: (answer: string) => void) => {
          setTimeout(() => {
            if (callCount < invalidAnswers.length) {
              callback(invalidAnswers[callCount++]);
            } else {
              callback("yes");
            }
          }, 0);
        },
      );

      const result = await questionWithChoices(
        promptText,
        choices,
        undefined,
        limitMessage,
      );
      expect(result).toBe("yes");
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it("should not show limit message when none provided", async () => {
      const promptText = "Choose: ";
      const choices = ["a", "b"];

      let callCount = 0;
      mockInterface.question.mockImplementation(
        (prompt: string, callback: (answer: string) => void) => {
          setTimeout(() => {
            if (callCount === 0) {
              callCount++;
              callback("c"); // Invalid
            } else {
              callback("a"); // Valid
            }
          }, 0);
        },
      );

      const result = await questionWithChoices(promptText, choices);
      expect(result).toBe("a");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should handle empty string as valid choice", async () => {
      const promptText = "Press Enter to continue or type 'cancel': ";
      const choices = ["", "cancel"];

      mockInterface.question.mockImplementationOnce(
        (prompt: string, callback: (answer: string) => void) => {
          setTimeout(() => callback(""), 0);
        },
      );

      const result = await questionWithChoices(promptText, choices);
      expect(result).toBe("");
    });

    it("should handle choice with spaces", async () => {
      const promptText = "Choose an option: ";
      const choices = ["option one", "option two", "option three"];
      const userChoice = "option two";

      mockInterface.question.mockImplementationOnce(
        (prompt: string, callback: (answer: string) => void) => {
          setTimeout(() => callback(userChoice), 0);
        },
      );

      const result = await questionWithChoices(promptText, choices);
      expect(result).toBe(userChoice);
    });
  });
});
