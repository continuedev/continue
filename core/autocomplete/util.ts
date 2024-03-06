export class ListenableGenerator<T> {
  private _source: AsyncGenerator<T>;
  private _buffer: T[] = [];
  private _listeners: Set<(value: T) => void> = new Set();
  private _isEnded: boolean = false;

  constructor(
    source: AsyncGenerator<T>,
    private readonly onError: (e: any) => void,
  ) {
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
    } catch (e) {
      this.onError(e);
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
  currentGenerator: ListenableGenerator<string> | undefined;
  pendingGeneratorPrefix: string | undefined;
  pendingCompletion: string = "";

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
    for await (let chunk of this.currentGenerator!.tee()) {
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
