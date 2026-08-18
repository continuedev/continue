import { describe, it, expect } from "vitest";
import { ActionGateDebtContextProvider, GENESIS_HASH } from "./ActionGateDebtProvider";

describe("ActionGateDebtContextProvider", () => {
  it("should approve clean refactoring with high readiness score", () => {
    const provider = new ActionGateDebtContextProvider(80);
    const report = provider.evaluateRefactor(
      "src/server.ts",
      "const a = 1;\nconst b = 2;\n",
      "const a = 1;\nconst b = 2;\nconst c = 3;\n",
      {
        unboundedLoops: 0,
        unhandledExceptions: 0,
        unGatedMutations: 0,
      },
    );

    expect(report.isProductionReady).toBe(true);
    expect(report.readinessScore).toBe(100);
    expect(report.criticalSmells.length).toBe(0);
    expect(report.receipt.currHash).toBeDefined();
  });

  it("should reject refactoring with unbounded loops and unhandled exceptions", () => {
    const provider = new ActionGateDebtContextProvider(80);
    const report = provider.evaluateRefactor(
      "src/agent.ts",
      "function run() {}\n",
      "function run() { while(true) {} }\n",
      {
        unboundedLoops: 1,
        unhandledExceptions: 2,
        unGatedMutations: 1,
      },
    );

    expect(report.isProductionReady).toBe(false);
    expect(report.readinessScore).toBeLessThan(50);
    expect(report.criticalSmells).toContain("DETECTED_1_UNBOUNDED_LOOPS");
    expect(report.criticalSmells).toContain(
      "DETECTED_2_UNHANDLED_EXCEPTION_PATHS",
    );
    expect(report.criticalSmells).toContain("DETECTED_1_UNGATED_MUTATIONS");
  });

  it("should maintain cryptographic hash-chain integrity", () => {
    const provider = new ActionGateDebtContextProvider();
    provider.evaluateRefactor("file1.ts", "a", "b");
    provider.evaluateRefactor("file2.ts", "c", "d");
    provider.evaluateRefactor("file3.ts", "e", "f");

    const entries = provider.getLedger().getEntries();
    expect(entries.length).toBe(3);
    expect(entries[0].prevHash).toBe(GENESIS_HASH);
    expect(entries[1].prevHash).toBe(entries[0].currHash);
    expect(entries[2].prevHash).toBe(entries[1].currHash);
    expect(provider.getLedger().verifyIntegrity()).toBe(true);
  });
});
