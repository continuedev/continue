export class ListenableGenerator<T> {
  private _source: AsyncGenerator<T>;
  private _buffer: T[] = [];
  private _listeners: Set<(value: T) => void> = new Set();
  private _isEnded: boolean = false;

  constructor(source: AsyncGenerator<T>) {
    this._source = source;
    this._start();
  }

  public cancel() {
    this._isEnded = true;
  }

  private async _start() {
    try {
      for await (const value of this._source) {
        if (this._isEnded) {
          break;
        }
        this._buffer.push(value);
        for (const listener of this._listeners) {
          listener(value);
        }
      }
    } finally {
      this._isEnded = true;
      for (const listener of this._listeners) {
        listener(null as any);
      }
    }
  }

  listen(listener: (value: T) => void) {
    this._listeners.add(listener);
    for (const value of this._buffer) {
      listener(value);
    }
    if (this._isEnded) {
      listener(null as any);
    }
  }

  async *tee(): AsyncGenerator<T> {
    try {
      for (const value of this._buffer) {
        yield value;
      }
      while (!this._isEnded) {
        let resolve: (value: any) => void;
        let promise = new Promise<T>((res) => {
          resolve = res;
          this._listeners.add(resolve!);
        });
        const value = await promise;
        this._listeners.delete(resolve!);

        yield value;
      }
    } finally {
      // this._listeners.delete(resolve!);
    }
  }
}

export class GeneratorReuseManager {
  static currentGenerator: ListenableGenerator<string> | undefined;
  static pendingGeneratorPrefix: string | undefined;
  static pendingCompletion: string = "";

  private static _createListenableGenerator(
    gen: AsyncGenerator<string>,
    prefix: string
  ) {
    GeneratorReuseManager.currentGenerator?.cancel();

    const listenableGen = new ListenableGenerator(gen);
    listenableGen.listen(
      (chunk) => (GeneratorReuseManager.pendingCompletion += chunk ?? "")
    );

    GeneratorReuseManager.pendingGeneratorPrefix = prefix;
    GeneratorReuseManager.pendingCompletion = "";
    GeneratorReuseManager.currentGenerator = listenableGen;
  }

  static async *getGenerator(
    prefix: string,
    newGenerator: () => AsyncGenerator<string>
  ): AsyncGenerator<string> {
    // Check if current can be reused
    if (
      !(
        GeneratorReuseManager.currentGenerator &&
        GeneratorReuseManager.pendingGeneratorPrefix &&
        (
          GeneratorReuseManager.pendingGeneratorPrefix +
          GeneratorReuseManager.pendingCompletion
        ).startsWith(prefix) &&
        // for e.g. backspace
        GeneratorReuseManager.pendingGeneratorPrefix?.length <= prefix?.length
      )
    ) {
      // Create a wrapper over the current generator to fix the prompt
      GeneratorReuseManager._createListenableGenerator(newGenerator(), prefix);
    }

    let alreadyTyped =
      prefix.slice(GeneratorReuseManager.pendingGeneratorPrefix?.length) || "";
    for await (let chunk of GeneratorReuseManager.currentGenerator!.tee()) {
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
      yield chunk;
    }
  }
}
