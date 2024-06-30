import { ModelDescription } from "..";
import { ControlPlaneSettings } from "./schema";

export interface ControlPlaneSessionInfo {
  accessToken: string;
  account: {
    label: string;
    id: string;
  };
}

export interface ControlPlaneWorkspace {
  id: string;
  title: string;
  settings: ControlPlaneSettings;
}

export interface ControlPlaneModelDescription extends ModelDescription {}

export class ControlPlaneClient {
  private static URL = "";

  constructor(
    private readonly sessionInfoPromise: Promise<
      ControlPlaneSessionInfo | undefined
    >,
  ) {}

  public async listWorkspaces(): Promise<ControlPlaneWorkspace[]> {
    return [
      {
        id: "default",
        title: "Default",
        settings: {
          models: [],
        } as any,
      },
    ];
    // const settings = await this.getSettings();
    // return settings.workspaces;
  }

  async getSettingsForWorkspace(
    workspaceId: string,
  ): Promise<ControlPlaneSettings> {
    return { models: [] } as any;
    // const response = await fetch(ControlPlaneClient.URL);
    // const settings = await response.json();
    // this.settings = settings;
    // return settings;
  }
}
