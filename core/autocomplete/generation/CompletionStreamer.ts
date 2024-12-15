import { CompletionOptions, ILLM } from "../..";
import { StreamTransformPipeline } from "../filtering/streamTransforms/StreamTransformPipeline";
import { AutocompleteContext } from "../util/AutocompleteContext";

import { GeneratorReuseManager } from "./GeneratorReuseManager";

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
    ctx: AutocompleteContext,
  ) {
    // Try to reuse pending requests if what the user typed matches start of completion
    const generator = this.generatorReuseManager.getGenerator(
      prefix,
      (abortSignal: AbortSignal) =>
        llm.supportsFim()
          ? llm.streamFim(prefix, suffix, abortSignal, completionOptions)
          : llm.streamComplete(prompt, abortSignal, {
              ...completionOptions,
              raw: true,
            }),
      multiline,
    );

    // Full stop means to stop the LLM's generation, instead of just truncating the displayed completion
    const fullStop = () =>
      this.generatorReuseManager.currentGenerator?.cancel();

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
    const transformedGenerator = ctx.options.transform
      ? this.streamTransformPipeline.transform(
          initialGenerator,
          prefix,
          suffix,
          multiline,
          completionOptions?.stop || [],
          fullStop,
          ctx,
        )
      : initialGenerator;

    for await (const update of transformedGenerator) {
      yield update;
    }
  }
}
