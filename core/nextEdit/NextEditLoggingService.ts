import { COUNT_COMPLETION_REJECTED_AFTER } from "../util/parameters";

import { DataLogger } from "../data/log";
import { Telemetry } from "../util/posthog";
import { NextEditOutcome } from "./types";

export class NextEditLoggingService {
  private static instance: NextEditLoggingService;

  // Key is completionId
  private _abortControllers = new Map<string, AbortController>();
  private _logRejectionTimeouts = new Map<string, NodeJS.Timeout>();
  private _outcomes = new Map<string, NextEditOutcome>();
  _lastDisplayedCompletion: { id: string; displayedAt: number } | undefined =
    undefined;

  private constructor() {}

  public static getInstance(): NextEditLoggingService {
    if (!NextEditLoggingService.instance) {
      NextEditLoggingService.instance = new NextEditLoggingService();
    }
    return NextEditLoggingService.instance;
  }

  public createAbortController(completionId: string): AbortController {
    const abortController = new AbortController();
    this._abortControllers.set(completionId, abortController);
    return abortController;
  }

  public deleteAbortController(completionId: string) {
    this._abortControllers.delete(completionId);
  }

  public cancel() {
    this._abortControllers.forEach((abortController, id) => {
      abortController.abort();
    });
    this._abortControllers.clear();
  }

  public accept(completionId: string): NextEditOutcome | undefined {
    if (this._logRejectionTimeouts.has(completionId)) {
      clearTimeout(this._logRejectionTimeouts.get(completionId));
      this._logRejectionTimeouts.delete(completionId);
    }
    if (this._outcomes.has(completionId)) {
      const outcome = this._outcomes.get(completionId)!;
      outcome.accepted = true;
      this.logNextEditOutcome(outcome);
      this._outcomes.delete(completionId);
      return outcome;
    }
  }

  public reject(completionId: string): NextEditOutcome | undefined {
    if (this._logRejectionTimeouts.has(completionId)) {
      clearTimeout(this._logRejectionTimeouts.get(completionId));
      this._logRejectionTimeouts.delete(completionId);
    }

    if (this._outcomes.has(completionId)) {
      const outcome = this._outcomes.get(completionId)!;
      outcome.accepted = false;
      this.logNextEditOutcome(outcome);
      this._outcomes.delete(completionId);
      return outcome;
    }
  }

  public cancelRejectionTimeout(completionId: string) {
    if (this._logRejectionTimeouts.has(completionId)) {
      clearTimeout(this._logRejectionTimeouts.get(completionId)!);
      this._logRejectionTimeouts.delete(completionId);
    }
    if (this._outcomes.has(completionId)) {
      this._outcomes.delete(completionId);
    }
  }

  public cancelRejectionTimeoutButKeepCompletionId(completionId: string) {
    if (this._logRejectionTimeouts.has(completionId)) {
      clearTimeout(this._logRejectionTimeouts.get(completionId)!);
    }
  }

  public markDisplayed(completionId: string, outcome: NextEditOutcome) {
    const logRejectionTimeout = setTimeout(() => {
      // Wait 10 seconds, then assume it wasn't accepted
      outcome.accepted = false;
      this.logNextEditOutcome(outcome);
      this._logRejectionTimeouts.delete(completionId);
    }, COUNT_COMPLETION_REJECTED_AFTER);
    this._outcomes.set(completionId, outcome);
    this._logRejectionTimeouts.set(completionId, logRejectionTimeout);

    // If the previously displayed completion is still waiting for rejection,
    // and this one is a continuation of that (the outcome.completion is the same modulo prefix)
    // then we should cancel the rejection timeout
    const previous = this._lastDisplayedCompletion;
    const now = Date.now();
    if (previous && this._logRejectionTimeouts.has(previous.id)) {
      const previousOutcome = this._outcomes.get(previous.id);
      const c1 = previousOutcome?.completion.split("\n")[0] ?? "";
      const c2 = outcome.completion.split("\n")[0];
      if (
        previousOutcome &&
        (c1.endsWith(c2) ||
          c2.endsWith(c1) ||
          c1.startsWith(c2) ||
          c2.startsWith(c1))
      ) {
        this.cancelRejectionTimeout(previous.id);
      } else if (now - previous.displayedAt < 500) {
        // If a completion isn't shown for more than
        this.cancelRejectionTimeout(previous.id);
      }
    }

    this._lastDisplayedCompletion = {
      id: completionId,
      displayedAt: now,
    };
  }

  private logNextEditOutcome(outcome: NextEditOutcome) {
    void DataLogger.getInstance().logDevData({
      name: "nextEditOutcome",
      data: outcome,
      // data: {
      //   ...outcome, // TODO: this is somehow getting messed up with autocomplete schema.
      // },
    });

    // const { prompt, completion, prefix, suffix, ...restOfOutcome } = outcome;
    void Telemetry.capture("nextEditOutcome", outcome, true);
  }
}
