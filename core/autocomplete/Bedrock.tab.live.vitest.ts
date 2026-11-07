import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

import Bedrock from "../llm/llms/Bedrock";
import { DEFAULT_AUTOCOMPLETE_OPTS } from "../util/parameters";
import { languageForFilepath } from "./constants/AutocompleteLanguageInfo";
import { StreamTransformPipeline } from "./filtering/streamTransforms/StreamTransformPipeline";
import { postprocessCompletion } from "./postprocessing";
import { getTemplateForModel } from "./templating/AutocompleteTemplate";
import { getStopTokens } from "./templating/getStopTokens";
import { HelperVars } from "./util/HelperVars";

/**
 * Live Bedrock check of Tab autocomplete: the prompt the fork picks for each
 * model, sent through the Bedrock provider, then through the same stream
 * filters and post-processing the editor uses. Fails if a model returns
 * prose instead of code, or nothing.
 *
 * Opt-in: RUN_BEDROCK_LIVE=1 and a Bedrock credential in the environment.
 *
 *   RUN_BEDROCK_LIVE=1 npx vitest run autocomplete/Bedrock.tab.live.vitest.ts
 *
 * Knobs: LIVE_TAB_MODELS, LIVE_TAB_RUNS (default 2; the first run can be a
 * cold start), LIVE_TAB_MAX_TTFT_MS (fails a warm run slower than this).
 */
const live = process.env.RUN_BEDROCK_LIVE === "1" ? describe : describe.skip;

const MODELS = (
  process.env.LIVE_TAB_MODELS ??
  "qwen.qwen3-coder-30b-a3b-v1:0,us.amazon.nova-micro-v1:0,us.amazon.nova-lite-v1:0,mistral.ministral-3-8b-instruct,mistral.devstral-2-123b"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
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

function buildPrompt(model: string) {
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
  return {
    prompt,
    lang,
    stop: getStopTokens(completionOptions, lang, model),
    completionOptions,
  };
}

/** The parts of HelperVars the stream filters read. */
function helperFor(llm: Bedrock, lang: ReturnType<typeof languageForFilepath>) {
  const fileLines = (PREFIX + SUFFIX).split("\n");
  return {
    lang,
    filepath: FILEPATH,
    fileLines,
    pos: { line: PREFIX.split("\n").length - 1, character: 2 },
    options: {
      ...DEFAULT_AUTOCOMPLETE_OPTS,
      ...llm.providerAutocompleteDefaults,
    },
  } as unknown as HelperVars;
}

live("Bedrock Tab autocomplete (live)", () => {
  it.each(MODELS)(
    "%s completes code",
    async (model) => {
      const llm = new Bedrock({
        model,
        region: process.env.AWS_REGION ?? "us-east-1",
      });
      const { prompt, lang, stop, completionOptions } = buildPrompt(model);

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
          helperFor(llm, lang),
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
        const total = performance.now() - started;
        console.log(
          `LIVE tab ${model} | run ${run} | ttft ${firstToken.toFixed(0)}ms | total ${total.toFixed(0)}ms | ${JSON.stringify(shown.slice(0, 120))}`,
        );

        expect(shown).toMatch(/sqrt|hypot|\*\*\s*0\.5/);
        expect(shown.trim().toLowerCase()).not.toMatch(
          /^(here|sure|certainly|let's|we need|the )/,
        );
        expect(shown).not.toContain("<COMPLETION>");
        if (MAX_TTFT && run > 0) {
          expect(firstToken).toBeLessThan(MAX_TTFT);
        }
      }
    },
    120_000,
  );
});
