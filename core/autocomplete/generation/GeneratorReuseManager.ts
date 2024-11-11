import { ListenableGenerator } from "./ListenableGenerator";

export class GeneratorReuseManager {
  currentGenerator: ListenableGenerator<string> | undefined;
  pendingGeneratorPrefix: string | undefined;
  pendingCompletion = "";

  constructor(private readonly onError: (err: any) => void) {}

  private _createListenableGenerator(
    gen: AsyncGenerator<string>,
    prefix: string,
  ) {
    this.currentGenerator?.cancel();

    const listenableGen = new ListenableGenerator(gen, this.onError);
    listenableGen.listen((chunk) => (this.pendingCompletion += chunk ?? ""));

    this.pendingGeneratorPrefix = prefix;
    this.pendingCompletion = "";
    this.currentGenerator = listenableGen;
  }

  async *getGenerator(
    prefix: string,
    newGenerator: () => AsyncGenerator<string>,
    multiline: boolean,
  ): AsyncGenerator<string> {
    // Check if current can be reused
    if (
      !(
        this.currentGenerator &&
        this.pendingGeneratorPrefix &&
        (this.pendingGeneratorPrefix + this.pendingCompletion).startsWith(
          prefix,
        ) &&
        // for e.g. backspace
        this.pendingGeneratorPrefix?.length <= prefix?.length
      )
    ) {
      // Create a wrapper over the current generator to fix the prompt
      this._createListenableGenerator(newGenerator(), prefix);
    }

    let alreadyTyped = prefix.slice(this.pendingGeneratorPrefix?.length) || "";
    for await (let chunk of this.currentGenerator?.tee() ?? []) {
      if (!chunk) {
        continue;
      }
      while (chunk.length && alreadyTyped.length) {
        if (chunk[0] === alreadyTyped[0]) {
          alreadyTyped = alreadyTyped.slice(1);
          chunk = chunk.slice(1);
        } else {
          break;
        }
      }

      const newLineIndex = chunk.indexOf("\n");
      if (multiline || newLineIndex === -1) {
        yield chunk;
      } else {
        yield chunk.slice(0, newLineIndex);
        break;
      }
    }
  }
}
