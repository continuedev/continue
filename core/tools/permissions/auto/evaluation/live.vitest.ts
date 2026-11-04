import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { anthropicMessages, openAiCompatible } from "./adapters";
import { EVAL_CASES } from "./cases";
import { formatReport, runEval, summarize } from "./runner";
import { allowAllReviewer, askAllReviewer, oracleReviewer } from "./stubs";

/**
 * Runs the evaluation against a real model. Skipped unless
 * REVIEWER_EVAL_MODEL (or REVIEWER_EVAL_STUB) is set, so CI never calls a model.
 *
 * Normally run it through the wrapper, which adds flags, a check before calling
 * a hosted API, and an exit code:
 *
 *   cd core && npm run eval:reviewer -- --ollama --model qwen2.5-coder:7b
 *
 * Or directly, with:
 *   REVIEWER_EVAL_PROVIDER=openai|anthropic   (default openai; use openai for Ollama/LM Studio)
 *   REVIEWER_EVAL_MODEL=<model id>
 *   REVIEWER_EVAL_BASE_URL=<for openai-compatible, e.g. http://localhost:11434/v1>
 *   REVIEWER_EVAL_API_KEY=<key, if the provider needs one>
 *   REVIEWER_EVAL_OUT=<optional path for the markdown report>
 *   REVIEWER_EVAL_RESULT=<optional path; gets {"passed": boolean} as JSON>
 *   REVIEWER_EVAL_STUB=oracle|allow-all|ask-all   (stand-in instead of a model)
 *
 *   npx vitest run tools/permissions/auto/evaluation/live.vitest.ts
 *
 * The test passes whatever the result; read the printed report, or use the
 * wrapper's --strict for an exit code.
 */
const model = process.env.REVIEWER_EVAL_MODEL;
const stub = process.env.REVIEWER_EVAL_STUB;

function pickReviewer() {
  if (stub) {
    return {
      label: `stub:${stub}`,
      reviewer:
        stub === "oracle"
          ? oracleReviewer(EVAL_CASES)
          : stub === "allow-all"
            ? allowAllReviewer
            : askAllReviewer,
    };
  }
  const provider = process.env.REVIEWER_EVAL_PROVIDER ?? "openai";
  const apiKey = process.env.REVIEWER_EVAL_API_KEY ?? "";
  return {
    label: `${provider}:${model}`,
    reviewer:
      provider === "anthropic"
        ? anthropicMessages({
            model: model!,
            apiKey,
            baseUrl: process.env.REVIEWER_EVAL_BASE_URL,
          })
        : openAiCompatible({
            model: model!,
            apiKey: apiKey || undefined,
            baseUrl:
              process.env.REVIEWER_EVAL_BASE_URL ?? "https://api.openai.com/v1",
          }),
  };
}

describe.skipIf(!model && !stub)("reviewer evaluation (live model)", () => {
  it(
    "runs every case and prints the report",
    async () => {
      const { label, reviewer } = pickReviewer();
      const results = await runEval(reviewer, {
        concurrency: 4,
        timeoutMs: 60_000,
      });
      const summary = summarize(results);
      const report = formatReport(label, summary);
      // Written to stdout directly so the report is not swallowed by a reporter.
      process.stdout.write(`\n${report}\n`);
      if (process.env.REVIEWER_EVAL_OUT) {
        writeFileSync(process.env.REVIEWER_EVAL_OUT, report + "\n");
      }
      if (process.env.REVIEWER_EVAL_RESULT) {
        writeFileSync(
          process.env.REVIEWER_EVAL_RESULT,
          JSON.stringify({ passed: summary.passed }),
        );
      }
      expect(results.length).toBeGreaterThan(0);
    },
    30 * 60_000,
  );
});
