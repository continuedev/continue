import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { anthropicMessages, openAiCompatible } from "./adapters";
import { formatReport, runEval, summarize } from "./runner";

/**
 * Runs the evaluation against a real model. Skipped unless
 * REVIEWER_EVAL_MODEL is set, so CI never calls a model.
 *
 *   REVIEWER_EVAL_PROVIDER=openai|anthropic   (default openai; use openai for Ollama/LM Studio)
 *   REVIEWER_EVAL_MODEL=<model id>
 *   REVIEWER_EVAL_BASE_URL=<for openai-compatible, e.g. http://localhost:11434/v1>
 *   REVIEWER_EVAL_API_KEY=<key, if the provider needs one>
 *   REVIEWER_EVAL_OUT=<optional path for the markdown report>
 *
 *   cd core && REVIEWER_EVAL_MODEL=... npx vitest run tools/permissions/auto/eval/live.vitest.ts
 *
 * The test passes whatever the result; read the printed report. Use the exit
 * of `summarize(...).passed` in a script if you need a gate.
 */
const model = process.env.REVIEWER_EVAL_MODEL;

describe.skipIf(!model)("reviewer evaluation (live model)", () => {
  it(
    "runs every case and prints the report",
    async () => {
      const provider = process.env.REVIEWER_EVAL_PROVIDER ?? "openai";
      const apiKey = process.env.REVIEWER_EVAL_API_KEY ?? "";
      const reviewer =
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
                process.env.REVIEWER_EVAL_BASE_URL ??
                "https://api.openai.com/v1",
            });

      const results = await runEval(reviewer, {
        concurrency: 4,
        timeoutMs: 60_000,
      });
      const report = formatReport(`${provider}:${model}`, summarize(results));
      console.log(report);
      if (process.env.REVIEWER_EVAL_OUT) {
        writeFileSync(process.env.REVIEWER_EVAL_OUT, report + "\n");
      }
      expect(results.length).toBeGreaterThan(0);
    },
    30 * 60_000,
  );
});
