import OpenAIEmbeddingsProvider from "./OpenAIEmbeddingsProvider";

class ContinueProxyEmbeddingsProvider extends OpenAIEmbeddingsProvider {
  private _workOsAccessToken: string | undefined = undefined;

  get workOsAccessToken(): string | undefined {
    return this._workOsAccessToken;
  }

  set workOsAccessToken(value: string | undefined) {
    if (this._workOsAccessToken !== value) {
      this._workOsAccessToken = value;
      this.options.apiKey = value;
    }
  }
}

export default ContinueProxyEmbeddingsProvider;
