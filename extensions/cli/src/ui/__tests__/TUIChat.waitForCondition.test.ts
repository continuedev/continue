import { waitForCondition } from "./TUIChat.testHelper.js";

describe("waitForCondition utility function", () => {
  describe("basic functionality", () => {
    it("resolves immediately when condition is already true", async () => {
      const startTime = Date.now();
      await waitForCondition(() => true, 1000, 50);
      const elapsed = Date.now() - startTime;

      // Should resolve almost immediately (within first interval)
      expect(elapsed).toBeLessThan(100);
    });

    it("waits for condition to become true", async () => {
      let counter = 0;
      const startTime = Date.now();

      await waitForCondition(
        () => {
          counter++;
          return counter >= 3;
        },
        2000,
        50,
      );

      const elapsed = Date.now() - startTime;

      // Should have waited for at least 2 intervals (100ms)
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(counter).toBeGreaterThanOrEqual(3);
    });

    it("respects custom timeout value", async () => {
      const customTimeout = 500;
      const startTime = Date.now();

      // This will timeout since condition never becomes true
      await waitForCondition(() => false, customTimeout, 50);

      const elapsed = Date.now() - startTime;

      // Should have waited approximately the timeout duration
      expect(elapsed).toBeGreaterThanOrEqual(customTimeout);
      expect(elapsed).toBeLessThan(customTimeout + 200); // Allow 200ms buffer
    });

    it("respects custom interval value", async () => {
      let callCount = 0;
      const interval = 100;
      const timeout = 1000;

      await waitForCondition(
        () => {
          callCount++;
          return callCount >= 5;
        },
        timeout,
        interval,
      );

      // With 100ms interval and 5 calls needed, should take ~400-500ms
      // Call count should be close to expected
      expect(callCount).toBeGreaterThanOrEqual(5);
      expect(callCount).toBeLessThan(15); // Should not be called excessively
    });
  });

  describe("edge cases", () => {
    it("waits until condition becomes true despite initial false values", async () => {
      let attemptCount = 0;

      await waitForCondition(
        () => {
          attemptCount++;
          // Return false for first 2 attempts, then true
          return attemptCount >= 3;
        },
        2000,
        50,
      );

      // Should have waited and eventually succeeded
      expect(attemptCount).toBeGreaterThanOrEqual(3);
    });

    it("handles complex condition logic", async () => {
      let counter = 0;
      const startTime = Date.now();

      await waitForCondition(
        () => {
          counter++;
          // Condition becomes true after some iterations
          return counter >= 3 && Date.now() - startTime > 100;
        },
        2000,
        50,
      );

      expect(counter).toBeGreaterThanOrEqual(3);
      expect(Date.now() - startTime).toBeGreaterThanOrEqual(100);
    });

    it("handles very short timeout", async () => {
      const startTime = Date.now();

      await waitForCondition(() => false, 10, 5);

      const elapsed = Date.now() - startTime;

      // Should respect even very short timeouts
      expect(elapsed).toBeGreaterThanOrEqual(10);
      expect(elapsed).toBeLessThan(100);
    });

    it("handles very short interval", async () => {
      let callCount = 0;
      const startTime = Date.now();

      await waitForCondition(
        () => {
          callCount++;
          return Date.now() - startTime > 100;
        },
        500,
        5, // 5ms interval (more realistic than 1ms)
      );

      // With 5ms interval over 100ms, should be called multiple times
      // Allow for slower systems - at least 10 calls
      expect(callCount).toBeGreaterThan(10);
    });

    it("handles very small timeout", async () => {
      const condition = vi.fn(() => true);
      const startTime = Date.now();

      await waitForCondition(condition, 1, 1);

      const elapsed = Date.now() - startTime;

      // Should check at least once with minimal timeout
      expect(condition).toHaveBeenCalled();
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("performance characteristics", () => {
    it("does not busy-wait between checks", async () => {
      const callTimestamps: number[] = [];
      const interval = 50;

      await waitForCondition(
        () => {
          callTimestamps.push(Date.now());
          return callTimestamps.length >= 5;
        },
        2000,
        interval,
      );

      // Check that there's roughly the expected interval between calls
      for (let i = 1; i < callTimestamps.length; i++) {
        const actualInterval = callTimestamps[i] - callTimestamps[i - 1];
        // Allow some tolerance (30ms buffer)
        expect(actualInterval).toBeGreaterThanOrEqual(interval - 30);
        expect(actualInterval).toBeLessThan(interval + 100);
      }
    });

    it("returns immediately after condition becomes true mid-wait", async () => {
      let shouldBeTrue = false;
      const startTime = Date.now();

      // Set condition to true after 100ms
      setTimeout(() => {
        shouldBeTrue = true;
      }, 100);

      await waitForCondition(() => shouldBeTrue, 5000, 50);

      const elapsed = Date.now() - startTime;

      // Should return shortly after 100ms, not wait full timeout
      expect(elapsed).toBeLessThan(500);
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe("timeout behavior", () => {
    it("times out when condition never becomes true", async () => {
      const timeout = 200;
      const startTime = Date.now();

      await waitForCondition(() => false, timeout, 50);

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(timeout);
    });

    it("does not exceed timeout by significant margin", async () => {
      const timeout = 500;
      const startTime = Date.now();

      await waitForCondition(() => false, timeout, 50);

      const elapsed = Date.now() - startTime;

      // Should not exceed timeout by more than one interval
      expect(elapsed).toBeLessThan(timeout + 150);
    });
  });

  describe("real-world scenarios", () => {
    it("waits for UI frame to update", async () => {
      // Simulate a UI component that updates after a delay
      let frameContent = "";

      setTimeout(() => {
        frameContent = "Updated content";
      }, 150);

      const startTime = Date.now();
      await waitForCondition(() => frameContent.includes("Updated"), 2000, 50);
      const elapsed = Date.now() - startTime;

      expect(frameContent).toBe("Updated content");
      expect(elapsed).toBeGreaterThanOrEqual(150);
      expect(elapsed).toBeLessThan(500);
    });

    it("waits for async operation to complete", async () => {
      // Simulate an async operation
      let operationComplete = false;

      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        operationComplete = true;
      })();

      await waitForCondition(() => operationComplete, 3000, 50);

      expect(operationComplete).toBe(true);
    });

    it("handles multiple simultaneous waits", async () => {
      let counter1 = 0;
      let counter2 = 0;
      let counter3 = 0;

      const increment1 = setInterval(() => counter1++, 30);
      const increment2 = setInterval(() => counter2++, 40);
      const increment3 = setInterval(() => counter3++, 50);

      const results = await Promise.all([
        waitForCondition(() => counter1 >= 5, 2000, 20),
        waitForCondition(() => counter2 >= 5, 2000, 20),
        waitForCondition(() => counter3 >= 5, 2000, 20),
      ]);

      clearInterval(increment1);
      clearInterval(increment2);
      clearInterval(increment3);

      expect(counter1).toBeGreaterThanOrEqual(5);
      expect(counter2).toBeGreaterThanOrEqual(5);
      expect(counter3).toBeGreaterThanOrEqual(5);
      expect(results).toHaveLength(3);
    });
  });

  describe("condition function variations", () => {
    it("handles condition returning various truthy values", async () => {
      const truthyValues: any[] = [1, "string", {}, [], true];

      for (const value of truthyValues) {
        await waitForCondition(() => Boolean(value), 100, 10);
        // Should not throw or timeout
      }
    });

    it("handles condition returning various falsy values", async () => {
      const falsyValues = [0, "", null, undefined, false];
      let index = 0;

      await waitForCondition(
        () => {
          const result = falsyValues[index];
          index++;
          // Return true after testing all falsy values
          return index > falsyValues.length;
        },
        1000,
        50,
      );

      expect(index).toBeGreaterThan(falsyValues.length);
    });
  });

  describe("precision and timing", () => {
    it("maintains consistent interval timing under load", async () => {
      const timestamps: number[] = [];
      const interval = 50;

      await waitForCondition(
        () => {
          timestamps.push(Date.now());
          // Do some work to simulate load
          let sum = 0;
          for (let i = 0; i < 1000; i++) {
            sum += i;
          }
          return timestamps.length >= 10;
        },
        5000,
        interval,
      );

      // Calculate average interval
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }

      const avgInterval =
        intervals.reduce((a, b) => a + b, 0) / intervals.length;

      // Average should be close to expected interval (within 50%)
      expect(avgInterval).toBeGreaterThan(interval * 0.5);
      expect(avgInterval).toBeLessThan(interval * 2);
    });

    it("handles sub-millisecond precision requirements", async () => {
      const startTime = performance.now();
      let checkTime = 0;

      await waitForCondition(
        () => {
          checkTime = performance.now();
          return checkTime - startTime > 25;
        },
        1000,
        5,
      );

      const elapsed = checkTime - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(25);
      expect(elapsed).toBeLessThan(100);
    });
  });
});
