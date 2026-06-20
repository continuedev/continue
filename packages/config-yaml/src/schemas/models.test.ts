import { describe, expect, it } from "@jest/globals";
import { requestOptionsSchema } from "./models.js";

describe("requestOptionsSchema", () => {
  it("should preserve Ollama request body overrides", () => {
    const result = requestOptionsSchema.parse({
      keepAlive: -1,
      options: {
        num_gpu: 20,
        num_thread: 8,
        keep_alive: -1,
      },
    });

    expect(result).toEqual({
      keepAlive: -1,
      options: {
        num_gpu: 20,
        num_thread: 8,
        keep_alive: -1,
      },
    });
  });
});
