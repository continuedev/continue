import { CompletionOptions, ILLM } from "../..";
import { StreamTransformPipeline } from "../filtering/streamTransforms/StreamTransformPipeline";
import { HelperVars } from "../util/HelperVars";

import { GeneratorReuseManager } from "./GeneratorReuseManager";
import { stopAfterMaxProcessingTime } from "./utils";

export class CompletionStreamer {
  private streamTransformPipeline = new StreamTransformPipeline();
  private generatorReuseManager: GeneratorReuseManager;

  constructor(onError: (err: any) => void) {
    this.generatorReuseManager = new GeneratorReuseManager(onError);
  }

  async *streamCompletionWithFilters(
    token: AbortSignal,
    llm: ILLM,
    prefix: string,
    suffix: string,
    prompt: string,
    multiline: boolean,
    completionOptions: Partial<CompletionOptions> | undefined,
    helper: HelperVars,
  ) {
    // Full stop means to stop the LLM's generation, instead of just truncating the displayed completion
    const fullStop = () =>
      this.generatorReuseManager.currentGenerator?.cancel();

    // Try to reuse pending requests if what the user typed matches start of completion
    const generator = this.generatorReuseManager.getGenerator(
      prefix,
      (abortSignal: AbortSignal) => {
        const generator = llm.supportsFim()
          ? llm.streamFim(prefix, suffix, abortSignal, completionOptions)
          : llm.streamComplete(prompt, abortSignal, {
              ...completionOptions,
              raw: true,
            });

        /**
         * This transformer applies even on reused generator. We are deliberately
         * not using streamTransformPipeline because we want to capture and stop
         * the request even if the generator is being reused.
         */
        return helper.options.transform
          ? stopAfterMaxProcessingTime(
              generator,
              helper.options.modelTimeout * 2.5,
              fullStop,
            )
          : generator;
      },
      multiline,
    );

    // LLM
    const generatorWithCancellation = async function* () {
      for await (const update of generator) {
        if (token.aborted) {
          return;
        }
        yield update;
      }
    };

    const initialGenerator = generatorWithCancellation();
    const transformedGenerator = helper.options.transform
      ? this.streamTransformPipeline.transform(
          initialGenerator,
          prefix,
          suffix,
          multiline,
          completionOptions?.stop || [],
          fullStop,
          helper,
        )
      : initialGenerator;

    for await (const update of transformedGenerator) {
      yield update;
    }
  }
}
