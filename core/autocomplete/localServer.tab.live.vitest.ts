import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

import OpenAI from "../llm/llms/OpenAI";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../util/parameters";
import { languageForFilepath } from "./constants/AutocompleteLanguageInfo";
import { StreamTransformPipeline } from "./filtering/streamTransforms/StreamTransformPipeline";
import { postprocessCompletion } from "./postprocessing";
import { getTemplateForModel } from "./templating/AutocompleteTemplate";
import { getStopTokens } from "./templating/getStopTokens";
import { HelperVars } from "./util/HelperVars";

/**
 * Live check of Tab autocomplete against a local OpenAI-compatible server
 * (Strata, llama.cpp, vLLM, LM Studio...) through the `openai` provider: the
 * prompt the fork picks for the model, the request, then the same stream
 * filters and post-processing the editor uses. Strata serves only chat, so
 * this covers the fallback from `/v1/completions` and thinking being off.
 *
 * Opt-in: RUN_LOCAL_LIVE=1 and a running server.
 *
 *   RUN_LOCAL_LIVE=1 LIVE_LOCAL_BASE=http://127.0.0.1:8083/v1/ npx vitest run autocomplete/localServer.tab.live.vitest.ts
 *
 * Knobs: LIVE_LOCAL_BASE (default http://127.0.0.1:8080/v1/), LIVE_LOCAL_MODEL
 * (default: the first model the server lists), LIVE_TAB_RUNS (default 2),
 * LIVE_TAB_MAX_TTFT_MS (fails a warm run slower than this).
 */
const live = process.env.RUN_LOCAL_LIVE === "1" ? describe : describe.skip;

const BASE = process.env.LIVE_LOCAL_BASE ?? "http://127.0.0.1:8080/v1/";
const RUNS = Number(process.env.LIVE_TAB_RUNS ?? 2);
const MAX_TTFT = Number(process.env.LIVE_TAB_MAX_TTFT_MS ?? 0);

const FILEPATH = "file:///workspace/src/geometry.ts";
const PREFIX = `export interface Point { x: number; y: number }

/** Distance between two points. */
export function distance(a: Point, b: Point): number {
  `;
const SUFFIX = `
}

/** The point halfway between a and b. */
export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
`;

async function modelId(): Promise<string> {
  if (process.env.LIVE_LOCAL_MODEL) return process.env.LIVE_LOCAL_MODEL;
  const response = await fetch(new URL("models", BASE));
  const list = await response.json();
  return list.data[0].id;
}

live("Tab autocomplete on a local server (live)", () => {
  it("completes code", async () => {
    const model = await modelId();
    const llm = new OpenAI({ model, apiBase: BASE, apiKey: "local" });
    const { template, completionOptions } = getTemplateForModel(model);
    const lang = languageForFilepath(FILEPATH);
    const prompt =
      typeof template === "string"
        ? Handlebars.compile(template)({
            prefix: PREFIX,
            suffix: SUFFIX,
            filename: "geometry.ts",
            reponame: "workspace",
            language: lang.name,
          })
        : template(PREFIX, SUFFIX, FILEPATH, "workspace", lang.name, [], []);
    const stop = getStopTokens(completionOptions, lang, model);
    const helper = {
      lang,
      filepath: FILEPATH,
      fileLines: (PREFIX + SUFFIX).split("\n"),
      pos: { line: PREFIX.split("\n").length - 1, character: 2 },
      options: {
        ...DEFAULT_AUTOCOMPLETE_OPTS,
        ...llm.providerAutocompleteDefaults,
      },
    } as unknown as HelperVars;

    for (let run = 0; run < RUNS; run++) {
      const controller = new AbortController();
      const started = performance.now();
      let firstToken = -1;
      const raw = llm.streamComplete(prompt, controller.signal, {
        ...completionOptions,
        stop,
        maxTokens: 120,
        temperature: 0.01,
        raw: true,
      });
      const timed = (async function* () {
        for await (const chunk of raw) {
          if (firstToken < 0 && chunk) {
            firstToken = performance.now() - started;
          }
          yield chunk;
        }
      })();

      let completion = "";
      for await (const chunk of new StreamTransformPipeline().transform(
        timed,
        PREFIX,
        SUFFIX,
        true,
        stop,
        () => controller.abort(),
        helper,
      )) {
        completion += chunk;
      }
      const shown =
        postprocessCompletion({
          completion,
          llm,
          prefix: PREFIX,
          suffix: SUFFIX,
        }) ?? "";
      console.log(
        `LIVE tab ${model} @ ${BASE} | run ${run} | ttft ${firstToken.toFixed(0)}ms | total ${(performance.now() - started).toFixed(0)}ms | ${JSON.stringify(shown.slice(0, 120))}`,
      );

      expect(shown).toMatch(/sqrt|hypot|\*\*\s*0\.5/);
      expect(shown.trim().toLowerCase()).not.toMatch(
        /^(here|sure|certainly|let's|we need|the |okay)/,
      );
      expect(shown).not.toContain("<COMPLETION>");
      expect(shown).not.toContain("<think>");
      if (MAX_TTFT && run > 0) {
        expect(firstToken).toBeLessThan(MAX_TTFT);
      }
    }
  }, 120_000);
});
