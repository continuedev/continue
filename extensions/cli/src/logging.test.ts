import chalk from "chalk";
import { vi } from "vitest";

import {
  configureLogger,
  isLoggingEnabled,
  log,
  error,
  info,
  warn,
  loggers,
} from "./logging.js";

describe("logging utilities", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset logger state
    configureLogger({ headless: false });

    // Mock console methods
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("configureLogger", () => {
    it("should configure logger for non-headless mode", () => {
      configureLogger({ headless: false });
      expect(isLoggingEnabled()).toBe(true);
    });

    it("should configure logger for headless mode", () => {
      configureLogger({ headless: true });
      expect(isLoggingEnabled()).toBe(false);
    });
  });

  describe("isLoggingEnabled", () => {
    it("should return true in non-headless mode", () => {
      configureLogger({ headless: false });
      expect(isLoggingEnabled()).toBe(true);
    });

    it("should return false in headless mode", () => {
      configureLogger({ headless: true });
      expect(isLoggingEnabled()).toBe(false);
    });

    it("should return true when forceEnable is true, even in headless mode", () => {
      configureLogger({ headless: true });
      expect(isLoggingEnabled(true)).toBe(true);
    });

    it("should return true when forceEnable is true in non-headless mode", () => {
      configureLogger({ headless: false });
      expect(isLoggingEnabled(true)).toBe(true);
    });
  });

  describe("log", () => {
    it("should log in non-headless mode", () => {
      configureLogger({ headless: false });
      log("test message");
      expect(consoleInfoSpy).toHaveBeenCalledWith("test message");
    });

    it("should not log in headless mode", () => {
      configureLogger({ headless: true });
      log("test message");
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it("should log in headless mode when forceLog is true", () => {
      configureLogger({ headless: true });
      log("test message", true);
      expect(consoleInfoSpy).toHaveBeenCalledWith("test message");
    });

    it("should log in non-headless mode when forceLog is true", () => {
      configureLogger({ headless: false });
      log("test message", true);
      expect(consoleInfoSpy).toHaveBeenCalledWith("test message");
    });
  });

  describe("error", () => {
    it("should log errors in non-headless mode", () => {
      configureLogger({ headless: false });
      error("error message");
      expect(consoleErrorSpy).toHaveBeenCalledWith("error message");
    });

    it("should log errors in headless mode by default (forceLog defaults to true)", () => {
      configureLogger({ headless: true });
      error("error message");
      expect(consoleErrorSpy).toHaveBeenCalledWith("error message");
    });

    it("should not log errors in headless mode when forceLog is false", () => {
      configureLogger({ headless: true });
      error("error message", false);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should log errors when forceLog is explicitly true", () => {
      configureLogger({ headless: true });
      error("error message", true);
      expect(consoleErrorSpy).toHaveBeenCalledWith("error message");
    });
  });

  describe("info", () => {
    it("should log info in non-headless mode", () => {
      configureLogger({ headless: false });
      info("info message");
      expect(consoleInfoSpy).toHaveBeenCalledWith("info message");
    });

    it("should not log info in headless mode", () => {
      configureLogger({ headless: true });
      info("info message");
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it("should log info in headless mode when forceLog is true", () => {
      configureLogger({ headless: true });
      info("info message", true);
      expect(consoleInfoSpy).toHaveBeenCalledWith("info message");
    });
  });

  describe("warn", () => {
    it("should log warnings in non-headless mode", () => {
      configureLogger({ headless: false });
      warn("warning message");
      expect(consoleWarnSpy).toHaveBeenCalledWith("warning message");
    });

    it("should not log warnings in headless mode", () => {
      configureLogger({ headless: true });
      warn("warning message");
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should log warnings in headless mode when forceLog is true", () => {
      configureLogger({ headless: true });
      warn("warning message", true);
      expect(consoleWarnSpy).toHaveBeenCalledWith("warning message");
    });
  });

  describe("loggers object", () => {
    beforeEach(() => {
      configureLogger({ headless: false });
    });

    it("should provide colored success logger", () => {
      loggers.success("success message");
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        chalk.green("success message"),
      );
    });

    it("should provide colored info logger", () => {
      loggers.info("info message");
      expect(consoleInfoSpy).toHaveBeenCalledWith(chalk.blue("info message"));
    });

    it("should provide colored warning logger", () => {
      loggers.warning("warning message");
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        chalk.yellow("warning message"),
      );
    });

    it("should provide colored error logger", () => {
      loggers.error("error message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red("error message"));
    });

    it("should provide colored debug logger", () => {
      loggers.debug("debug message");
      expect(consoleInfoSpy).toHaveBeenCalledWith(chalk.gray("debug message"));
    });

    it("should provide command logger that always logs", () => {
      configureLogger({ headless: true });
      loggers.command("command output");
      expect(consoleInfoSpy).toHaveBeenCalledWith("command output");
    });

    it("should respect forceLog parameter in colored loggers", () => {
      configureLogger({ headless: true });

      loggers.success("success message", false);
      expect(consoleInfoSpy).not.toHaveBeenCalled();

      loggers.success("success message", true);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        chalk.green("success message"),
      );
    });

    it("should handle error logger with default forceLog behavior", () => {
      configureLogger({ headless: true });

      loggers.error("error message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red("error message"));

      loggers.error("error message", false);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe("complex logging scenarios", () => {
    it("should handle different message types", () => {
      configureLogger({ headless: false });

      log("string message");
      log(123);
      log({ key: "value" });
      log(null);
      log(undefined);

      expect(consoleInfoSpy).toHaveBeenCalledTimes(5);
      expect(consoleInfoSpy).toHaveBeenCalledWith("string message");
      expect(consoleInfoSpy).toHaveBeenCalledWith(123);
      expect(consoleInfoSpy).toHaveBeenCalledWith({ key: "value" });
      expect(consoleInfoSpy).toHaveBeenCalledWith(null);
      expect(consoleInfoSpy).toHaveBeenCalledWith(undefined);
    });

    it("should maintain state across multiple configure calls", () => {
      configureLogger({ headless: false });
      expect(isLoggingEnabled()).toBe(true);

      configureLogger({ headless: true });
      expect(isLoggingEnabled()).toBe(false);

      configureLogger({ headless: false });
      expect(isLoggingEnabled()).toBe(true);
    });
  });
});
