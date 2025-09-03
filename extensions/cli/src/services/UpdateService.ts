import { exec, spawn } from "child_process";
import { logger } from "src/util/logger.js";
import { promisify } from "util";
import { compareVersions, getLatestVersion, getVersion } from "../version.js";
import { serviceContainer } from "./ServiceContainer.js";
import { UpdateServiceState, UpdateStatus } from "./types.js";

const execAsync = promisify(exec);

/**
 * Service for checking and performing CLI updates
 */
export class UpdateService {
  private state: UpdateServiceState;
  private serviceName = "update"; // Used for emitting events via serviceContainer

  constructor() {
    this.state = {
      autoUpdate: true, // TODO make configurable
      status: UpdateStatus.IDLE,
      message: "",
      error: null,
      isUpdateAvailable: false,
      latestVersion: null,
      currentVersion: getVersion(),
    };
  }

  /**
   * Initialize the update service
   */
  async initialize(headless?: boolean) {
    // Don't automatically check in tests/headless
    if (!headless && process.env.NODE_ENV !== "test") {
      await this.checkAndAutoUpdate();
    }

    return this.state;
  }

  getState(): UpdateServiceState {
    return this.state;
  }

  private async checkAndAutoUpdate() {
    await this.checkForUpdates();

    if (this.state.currentVersion === "0.0.0-dev") {
      return; // Uncomment to test update behavior
    }

    // If update is available, automatically update
    if (
      this.state.isUpdateAvailable &&
      this.state.autoUpdate &&
      this.state.status !== "updating"
    ) {
      if (process.env.CONTINUE_CLI_AUTO_UPDATED) {
        logger.debug("Already auto updated, preventing sequential auto-update");
      } else {
        await this.performUpdate(true);
      }
    }
  }

  private async checkForUpdates() {
    try {
      this.updateState({
        status: UpdateStatus.CHECKING,
        message: "Checking for updates",
      });

      const latestVersion = await getLatestVersion();

      if (!latestVersion) {
        this.updateState({
          status: UpdateStatus.IDLE,
          message: "Continue CLI",
          isUpdateAvailable: false,
        });
        return this.state;
      }

      const comparison = compareVersions(
        this.state.currentVersion,
        latestVersion,
      );
      const isUpdateAvailable = comparison === "older";

      this.updateState({
        status: UpdateStatus.IDLE,
        message: isUpdateAvailable
          ? `Update available: v${latestVersion}`
          : `Continue CLI v${this.state.currentVersion}`,
        isUpdateAvailable,
        latestVersion,
      });
    } catch (error: any) {
      logger.error("Error checking for updates:", error);
      this.updateState({
        status: UpdateStatus.ERROR,
        message: `Continue CLI v${this.state.currentVersion}`,
        error,
      });
    }
  }

  async performUpdate(isAutoUpdate?: boolean) {
    if (this.state.status === "updating") {
      return;
    }

    try {
      this.updateState({
        status: UpdateStatus.UPDATING,
        message: `Updating to v${this.state.latestVersion}`,
      });

      // Install the update
      const { stdout, stderr } = await execAsync("npm i -g @continuedev/cli");
      logger.debug("Update output:", { stdout, stderr });

      if (stderr) {
        const errLines = stderr.split("\n");
        for (const line of errLines) {
          const lower = line.toLowerCase().trim();
          if (
            !line ||
            lower.includes("debugger") ||
            lower.includes("npm warn")
          ) {
            continue;
          }
          throw new Error(stderr);
        }
      }

      if (isAutoUpdate) {
        this.updateState({
          status: UpdateStatus.UPDATED,
          message: `Updated to v${this.state.latestVersion}`,
          isUpdateAvailable: false,
        });
        this.restartCLI();
      } else {
        this.updateState({
          status: UpdateStatus.UPDATED,
          message: `Restart for v${this.state.latestVersion}`,
          isUpdateAvailable: false,
        });
      }
    } catch (error: any) {
      logger.error("Error updating CLI:", error);
      this.updateState({
        status: UpdateStatus.ERROR,
        message: isAutoUpdate ? "Auto-update failed" : "Update failed",
        error,
      });
      setTimeout(() => {
        this.updateState({
          status: UpdateStatus.IDLE,
          message: `/update to v${this.state.latestVersion}`,
        });
      }, 4000);
    }
  }

  private restartCLI(): void {
    try {
      const entryPoint = process.argv[1];
      const cliArgs = process.argv.slice(2);
      const nodeExecutable = process.execPath;

      logger.debug(
        `Preparing for CLI restart with: ${nodeExecutable} ${entryPoint} ${cliArgs.join(
          " ",
        )}`,
      );

      // Halt/clean up parent cn process
      try {
        // Remove all input listeners
        global.clearTimeout = () => {};
        global.clearInterval = () => {};
        process.stdin.removeAllListeners();
        process.stdin.pause();
        // console.clear(); // Don't want to clear things that were in console before cn started
      } catch (e) {
        logger.debug("Error cleaning up terminal:", e);
      }

      // Spawn a new detached cn process
      const child = spawn(nodeExecutable, [entryPoint, ...cliArgs], {
        detached: true,
        stdio: "inherit",
        env: {
          ...process.env,
          CONTINUE_CLI_AUTO_UPDATED: "true",
        },
      });
      child.on("exit", (code) => {
        process.exit(code);
      });

      // Unref child so parent can exit
      // I could not find a way to avoid a bug where next process has input glitches without leaving parent in place
      // So commenting this out is intentional for now
      // child.unref();
      // process.exit(0);
    } catch (error) {
      logger.error("Failed to restart CLI:", error);
    }
  }

  private updateState(partialState: Partial<UpdateServiceState>): void {
    this.state = {
      ...this.state,
      ...partialState,
    };

    serviceContainer.set(this.serviceName, this.state);
  }
}
