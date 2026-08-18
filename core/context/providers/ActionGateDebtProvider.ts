import { createHash } from "crypto";

export const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export interface IDEDebtReceipt {
  index: number;
  timestamp: string;
  filename: string;
  eventType: string;
  readinessScore: number;
  criticalSmells: string[];
  prevHash: string;
  currHash: string;
  metadata: Record<string, unknown>;
}

export interface InIDEDebtReport {
  filename: string;
  readinessScore: number;
  isProductionReady: boolean;
  debtDelta: number;
  criticalSmells: string[];
  receipt: IDEDebtReceipt;
}

export class ActionGateIDELedger {
  private entries: IDEDebtReceipt[] = [];
  private lastHash: string = GENESIS_HASH;

  public recordRefactor(
    filename: string,
    eventType: string,
    readinessScore: number,
    criticalSmells: string[],
    metadata: Record<string, unknown> = {},
  ): IDEDebtReceipt {
    const timestamp = new Date().toISOString();
    const index = this.entries.length;

    const metaString = JSON.stringify(metadata);
    const metaHash = createHash("sha256").update(metaString).digest("hex");

    const canonical = `${index}|${this.lastHash}|${filename}|${eventType}|${readinessScore}|${timestamp}|${metaHash}`;
    const currHash = createHash("sha256").update(canonical).digest("hex");

    const receipt: IDEDebtReceipt = {
      index,
      timestamp,
      filename,
      eventType,
      readinessScore,
      criticalSmells,
      prevHash: this.lastHash,
      currHash,
      metadata,
    };

    this.entries.push(receipt);
    this.lastHash = currHash;
    return receipt;
  }

  public getEntries(): IDEDebtReceipt[] {
    return [...this.entries];
  }

  public verifyIntegrity(): boolean {
    let prev = GENESIS_HASH;
    for (const entry of this.entries) {
      if (entry.prevHash !== prev) {
        return false;
      }
      prev = entry.currHash;
    }
    return true;
  }
}

export class ActionGateDebtContextProvider {
  public static readonly title = "ActionGate Production Debt";
  public static readonly description =
    "In-IDE real-time technical debt, refactor safety, and cryptographic due diligence scoring.";

  private ledger: ActionGateIDELedger;
  public readonly neverEquateIntentToApproval: boolean;
  public readonly minimumReadinessScore: number;

  constructor(
    minimumReadinessScore: number = 80,
    neverEquateIntentToApproval: boolean = true,
  ) {
    this.ledger = new ActionGateIDELedger();
    this.minimumReadinessScore = minimumReadinessScore;
    this.neverEquateIntentToApproval = neverEquateIntentToApproval;
  }

  public getLedger(): ActionGateIDELedger {
    return this.ledger;
  }

  public checkKillSwitch(): boolean {
    const envVal = (process.env.AAG_KILL_SWITCH || "").toLowerCase();
    return envVal === "true" || envVal === "1" || envVal === "yes";
  }

  public evaluateRefactor(
    filename: string,
    originalCode: string,
    refactoredCode: string,
    options: {
      unboundedLoops?: number;
      unhandledExceptions?: number;
      unGatedMutations?: number;
    } = {},
  ): InIDEDebtReport {
    if (this.checkKillSwitch()) {
      this.ledger.recordRefactor(
        filename,
        "refactor_blocked_kill_switch",
        0,
        ["EMERGENCY_KILL_SWITCH_ACTIVE"],
        { reason: "AAG_KILL_SWITCH is set" },
      );
      throw new Error(
        "A2Z SOC ActionGate: Emergency kill switch is engaged. In-IDE refactoring halted.",
      );
    }

    const unboundedLoops = options.unboundedLoops || 0;
    const unhandledExceptions = options.unhandledExceptions || 0;
    const unGatedMutations = options.unGatedMutations || 0;

    const criticalSmells: string[] = [];

    if (unboundedLoops > 0) {
      criticalSmells.push(`DETECTED_${unboundedLoops}_UNBOUNDED_LOOPS`);
    }
    if (unhandledExceptions > 0) {
      criticalSmells.push(`DETECTED_${unhandledExceptions}_UNHANDLED_EXCEPTION_PATHS`);
    }
    if (unGatedMutations > 0) {
      criticalSmells.push(`DETECTED_${unGatedMutations}_UNGATED_MUTATIONS`);
    }

    const originalLines = originalCode.split("\n").length;
    const refactoredLines = refactoredCode.split("\n").length;
    const lineDelta = refactoredLines - originalLines;

    // Debt Penalty Calculation
    const penalty =
      unboundedLoops * 30 +
      unhandledExceptions * 20 +
      unGatedMutations * 25 +
      (lineDelta > 50 ? 15 : 0);

    const readinessScore = Math.max(0, 100 - penalty);
    const isProductionReady =
      readinessScore >= this.minimumReadinessScore && criticalSmells.length === 0;

    const receipt = this.ledger.recordRefactor(
      filename,
      isProductionReady ? "refactor_approved" : "refactor_rejected_debt",
      readinessScore,
      criticalSmells,
      {
        lineDelta,
        neverEquateIntentToApproval: this.neverEquateIntentToApproval,
      },
    );

    return {
      filename,
      readinessScore,
      isProductionReady,
      debtDelta: penalty,
      criticalSmells,
      receipt,
    };
  }
}
