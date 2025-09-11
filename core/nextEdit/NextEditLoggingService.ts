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
  // Track minimal data for completions that get aborted before we have full outcome.
  private _pendingCompletions = new Map<
    string,
    {
      startTime: number;
      modelName?: string;
      modelProvider?: string;
      filepath?: string;
    }
  >();
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
    this.trackPendingCompletion(completionId);
    return abortController;
  }

  public deleteAbortController(completionId: string) {
    this._abortControllers.delete(completionId);
    this._pendingCompletions.delete(completionId);
  }

  // Keep track of a new completion request.
  public trackPendingCompletion(completionId: string) {
    this._pendingCompletions.set(completionId, {
      startTime: Date.now(),
    });
  }

  // Update pending completion info as it becomes available.
  public updatePendingCompletion(
    completionId: string,
    data: {
      modelName?: string;
      modelProvider?: string;
      filepath?: string;
    },
  ) {
    const pending = this._pendingCompletions.get(completionId);
    if (pending) {
      this._pendingCompletions.set(completionId, { ...pending, ...data });
    } else {
      // If we haven't tracked it yet, create new entry with provided data.
      this._pendingCompletions.set(completionId, {
        startTime: Date.now(),
        ...data,
      });
    }
  }

  public cancel() {
    this._abortControllers.forEach((abortController, completionId) => {
      this.handleAbort(completionId);
      abortController.abort();
    });
    this._abortControllers.clear();
  }

  public accept(completionId: string): NextEditOutcome | undefined {
    this._pendingCompletions.delete(completionId);

    if (this._logRejectionTimeouts.has(completionId)) {
      clearTimeout(this._logRejectionTimeouts.get(completionId));
      this._logRejectionTimeouts.delete(completionId);
    }
    if (this._outcomes.has(completionId)) {
      const outcome = this._outcomes.get(completionId)!;
      outcome.accepted = true;
      outcome.aborted = false;
      this.logNextEditOutcome(outcome);
      this._outcomes.delete(completionId);
      return outcome;
    }
  }

  public reject(completionId: string): NextEditOutcome | undefined {
    this._pendingCompletions.delete(completionId);

    if (this._logRejectionTimeouts.has(completionId)) {
      clearTimeout(this._logRejectionTimeouts.get(completionId));
      this._logRejectionTimeouts.delete(completionId);
    }

    if (this._outcomes.has(completionId)) {
      const outcome = this._outcomes.get(completionId)!;
      outcome.accepted = false;
      outcome.aborted = false;
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
    // Remove from pending since we now have full data.
    this._pendingCompletions.delete(completionId);
    outcome.aborted = false;

    const logRejectionTimeout = setTimeout(() => {
      // Wait 10 seconds, then assume it wasn't accepted
      outcome.accepted = false;
      outcome.aborted = false;
      this.logNextEditOutcome(outcome);
      this._logRejectionTimeouts.delete(completionId);
      this._outcomes.delete(completionId);
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

  public handleAbort(completionId: string) {
    // Clear any pending rejection timeout.
    if (this._logRejectionTimeouts.has(completionId)) {
      clearTimeout(this._logRejectionTimeouts.get(completionId));
      this._logRejectionTimeouts.delete(completionId);
    }

    // If we have the full outcome, log it as aborted.
    if (this._outcomes.has(completionId)) {
      const outcome = this._outcomes.get(completionId)!;
      outcome.accepted = false;
      outcome.aborted = true;
      this.logNextEditOutcome(outcome);
      this._outcomes.delete(completionId);
    } else {
      // Log minimal abort event for requests that never got displayed.
      const pendingData = this._pendingCompletions.get(completionId);

      const minimalAbortOutcome: Partial<NextEditOutcome> = {
        completionId,
        accepted: false,
        aborted: true,
        timestamp: Date.now(),
        uniqueId: completionId,
        elapsed: pendingData ? Date.now() - pendingData.startTime : 0,
        modelName: pendingData?.modelName || "unknown",
        modelProvider: pendingData?.modelProvider || "unknown",
        fileUri: pendingData?.filepath || "unknown",

        // Empty/default values for fields we don't have.
        completion: "",
        prompt: "",
        userEdits: "",
        userExcerpts: "",
        originalEditableRange: "",
        workspaceDirUri: "",
        cursorPosition: { line: -1, character: -1 },
        finalCursorPosition: { line: -1, character: -1 },
        editableRegionStartLine: -1,
        editableRegionEndLine: -1,
        diffLines: [],
        completionOptions: {},
      };

      this.logNextEditOutcome(minimalAbortOutcome as NextEditOutcome);
    }

    // Clean up.
    this._pendingCompletions.delete(completionId);
  }

  private logNextEditOutcome(outcome: NextEditOutcome) {
    if (outcome.aborted === undefined) {
      outcome.aborted = false;
    }

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
