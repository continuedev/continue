// Minimal mock for LLM API (just enough to prevent errors)
export class MockLlmApi {
  async chatCompletionStream(): Promise<AsyncIterable<any>> {
    return (async function* () {
      yield { choices: [{ delta: {}, index: 0, finish_reason: "stop" }] };
    })();
  }
  async chatCompletionNonStream() {
    throw new Error("Not implemented");
  }
  async completionStream() {
    throw new Error("Not implemented");
  }
  async completionNonStream() {
    throw new Error("Not implemented");
  }
  async streamChat() {
    return this.chatCompletionStream();
  }
  async completions() {
    throw new Error("Not implemented");
  }
  async streamCompletion() {
    throw new Error("Not implemented");
  }
  async chat() {
    throw new Error("Not implemented");
  }
  async rerank() {
    return { results: [] };
  }
  async embed() {
    return { data: [], usage: {} };
  }
  async fimComplete() {
    throw new Error("Not implemented");
  }
}
