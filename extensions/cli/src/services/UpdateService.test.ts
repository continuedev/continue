import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceContainer } from "./ServiceContainer.js";
import { UpdateStatus } from "./types.js";
import { UpdateService } from "./UpdateService.js";

vi.mock("core/util/GlobalContext.js", () => ({
  GlobalContext: class {
    get() {
      return undefined;
    }
    update() {}
  },
}));

vi.mock("../version.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../version.js")>()),
  // A packaged build: 0.0.0-dev skips the check altogether.
  getVersion: () => "2.4.5",
}));

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("UpdateService start-up check", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // The check used to finish before initialize() stored what it had returned,
  // so the "checking" state written first replaced the finished one for good.
  it("is idle after initialize, not stuck on checking", async () => {
    const service = new UpdateService();
    await service.initialize();
    await settle();

    expect(service.getState().status).toBe(UpdateStatus.IDLE);
    expect(service.getState().message).toBe("Continuous");
  });

  it("does not leave checking in the service container", async () => {
    const service = new UpdateService();
    const container = new ServiceContainer();
    container.register("update", () => service.initialize(), []);

    const loaded = await container.load("update");
    await settle();

    expect(loaded).toMatchObject({ status: UpdateStatus.IDLE });
    expect(container.getSync("update").value).toMatchObject({
      status: UpdateStatus.IDLE,
    });
  });

  it("skips the check when headless", async () => {
    const service = new UpdateService();
    await service.initialize(true);
    await settle();

    expect(service.getState().message).toBe("");
  });
});
