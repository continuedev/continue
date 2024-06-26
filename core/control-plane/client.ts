import {
  EmbeddingsProviderDescription,
  ModelDescription,
  RerankerDescription,
} from "..";

export interface ControlPlaneSessionInfo {
  accessToken: string;
  account: {
    label: string;
    id: string;
  };
}

export interface AnalyticsConfig {
  host: string;
  apiKey: string;
}

export interface ControlPlaneModelDescription extends ModelDescription {}

export interface ControlPlaneSettings {
  analytics?: AnalyticsConfig;
  models?: ControlPlaneModelDescription[];
  embeddingsProvider?: EmbeddingsProviderDescription;
  tabAutocompleteModel?: ModelDescription | ModelDescription[];
  reranker?: RerankerDescription;
}

export class ControlPlaneClient {
  private settings: ControlPlaneSettings | null = null;
  private static URL = "";

  constructor(
    private readonly sessionInfoPromise: Promise<
      ControlPlaneSessionInfo | undefined
    >,
  ) {}

  public async getSettings(): Promise<ControlPlaneSettings> {
    return this.settings ?? (await this.fetchSettings());
  }

  private async fetchSettings(): Promise<ControlPlaneSettings> {
    return {};
    // const response = await fetch(ControlPlaneClient.URL);
    // const settings = await response.json();
    // this.settings = settings;
    // return settings;
  }
}
