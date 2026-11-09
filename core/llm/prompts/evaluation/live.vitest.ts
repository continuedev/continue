import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PromptProfile } from "../turns";
import { anthropicMessages, openAiCompatible } from "./adapters";
import { formatReport, PROFILES, runTurnsEval, summarize } from "./runner";
import { TURN_SCENARIOS } from "./scenarios";
import { oracleModel, textOnlyModel } from "./stubs";

/**
 * Runs the turn-prompt evaluation against a real model. Skipped unless
 * TURNS_EVAL_MODEL (or TURNS_EVAL_STUB) is set, so CI never calls a model.
 *
 * Normally run it through the wrapper, which adds flags, a check before
 * calling a hosted API, and an exit code:
 *
 *   cd core && npm run eval:turns -- --ollama --model qwen2.5-coder:7b
 *
 * Or directly, with:
 *   TURNS_EVAL_PROVIDER=openai|anthropic   (default openai; use openai for Ollama/LM Studio)
 *   TURNS_EVAL_MODEL=<model id>
 *   TURNS_EVAL_BASE_URL=<for openai-compatible, e.g. http://localhost:11434/v1>
 *   TURNS_EVAL_API_KEY=<key, if the provider needs one>
 *   TURNS_EVAL_PROFILES=full,short         (default both)
 *   TURNS_EVAL_OUT=<optional path for the markdown report>
 *   TURNS_EVAL_RESULT=<optional path; gets {"passed": boolean} as JSON>
 *   TURNS_EVAL_STUB=oracle|text-only       (stand-in instead of a model)
 *
 *   npx vitest run llm/prompts/evaluation/live.vitest.ts
 *
 * The test passes whatever the result; read the printed report, or use the
 * wrapper's --strict for an exit code.
 */
const model = process.env.TURNS_EVAL_MODEL;
const stub = process.env.TURNS_EVAL_STUB;

function pickModel() {
  if (stub) {
    return {
      label: `stub:${stub}`,
      model: stub === "oracle" ? oracleModel(TURN_SCENARIOS) : textOnlyModel,
    };
  }
  const provider = process.env.TURNS_EVAL_PROVIDER ?? "openai";
  const apiKey = process.env.TURNS_EVAL_API_KEY ?? "";
  return {
    label: `${provider}:${model}`,
    model:
      provider === "anthropic"
        ? anthropicMessages({
            model: model!,
            apiKey,
            baseUrl: process.env.TURNS_EVAL_BASE_URL,
          })
        : openAiCompatible({
            model: model!,
            apiKey: apiKey || undefined,
            baseUrl:
              process.env.TURNS_EVAL_BASE_URL ?? "https://api.openai.com/v1",
          }),
  };
}

function pickProfiles(): readonly PromptProfile[] {
  const raw = process.env.TURNS_EVAL_PROFILES;
  if (!raw) return PROFILES;
  const chosen = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is PromptProfile => s === "full" || s === "short");
  return chosen.length ? chosen : PROFILES;
}

describe.skipIf(!model && !stub)("turn prompt evaluation (live model)", () => {
  it(
    "runs every scenario under each profile and prints the report",
    async () => {
      const { label, model: chat } = pickModel();
      const profiles = pickProfiles();
      const results = await runTurnsEval(chat, {
        profiles,
        concurrency: 2,
        timeoutMs: 120_000,
      });
      const summary = summarize(results, undefined, profiles);
      const report = formatReport(label, results, summary);
      // Written to stdout directly so the report is not swallowed by a reporter.
      process.stdout.write(`\n${report}\n`);
      if (process.env.TURNS_EVAL_OUT) {
        writeFileSync(process.env.TURNS_EVAL_OUT, report + "\n");
      }
      if (process.env.TURNS_EVAL_RESULT) {
        writeFileSync(
          process.env.TURNS_EVAL_RESULT,
          JSON.stringify({ passed: summary.passed }),
        );
      }
      expect(results.length).toBeGreaterThan(0);
    },
    30 * 60_000,
  );
});
