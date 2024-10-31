import { CompletionOptions, ILLM } from "../..";
import { StreamTransformPipeline } from "../filtering/streamTransforms/StreamTransformPipeline";
import { HelperVars } from "../HelperVars";
import { GeneratorReuseManager } from "./GeneratorReuseManager";

export class CompletionStreamer {
  private streamTransformPipeline = new StreamTransformPipeline();
  private generatorReuseManager: GeneratorReuseManager;

  constructor(private readonly onError: (err: any) => void) {
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
    // Try to reuse pending requests if what the user typed matches start of completion
    const generator = this.generatorReuseManager.getGenerator(
      prefix,
      () =>
        llm.supportsFim()
          ? llm.streamFim(prefix, suffix, completionOptions)
          : llm.streamComplete(prompt, {
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
    const finalGenerator = helper.options.transform
      ? this.streamTransformPipeline.transform(
          initialGenerator,
          prefix,
          suffix,
          helper.filepath,
          multiline,
          helper.pos,
          helper.fileLines,
          completionOptions?.stop || [],
          helper.lang,
          fullStop,
        )
      : initialGenerator;

    for await (const update of finalGenerator) {
      yield update;
    }
  }
}
