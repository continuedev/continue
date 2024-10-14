// BAS Customization
import { AbstractGenie, ActiveEnv, IGenieSession, UserContext, GenieProfile } from "@sap/gai-core";
import { getProfile } from "./profile";
import { ContinueGenieSession } from "./genie-session";

export class ContinueGenie extends AbstractGenie {
  constructor(gProfile: GenieProfile = getProfile()) {
    super(gProfile);
  }

  /**
   * [Mandatory] The file-level checking machanism for waking up the current BAS genie
   * (It can be invoked when an opened file tab is activated)
   * @param activeEnv
   * @returns
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- ignore
  async match(activeEnv: ActiveEnv): Promise<boolean> {
    return false;
  }

  /**
   * The default initial prompt shown in the Joule input field when activating the current BAS genie
   * (It's for UX quick input purpose)
   * @returns
   */
  async getInitialPrompt(activeEnv: ActiveEnv): Promise<string> {
    return super.getInitialPrompt(activeEnv);
  }

  /**
   * Override the auto attached system messages here
   * @returns
   */
  async getKnowledge(): Promise<string[]> {
    const knowledge = await super.getKnowledge();
    console.log("BAS Joule: the auto attached system messages are:");
    console.log(knowledge.join("\n"));
    return knowledge;
  }

  /**
   * Override the auto attahced user context messages here
   * @param prompt
   * @param session
   */
  async getContextPrompt(prompt: string, session: IGenieSession): Promise<string> {
    const userContext = await super.getContextPrompt(prompt, session);
    console.log("BAS Joule: the auto attached user context message is:");
    console.log(userContext);
    return userContext;
  }

  /**
   * Override the model vendor name here
   * @returns
   */
  async getModelVendor(): Promise<string> {
    const modeVendor = await super.getModelVendor();
    console.log("BAS Joule: the configured model is:");
    console.log(modeVendor);
    return modeVendor;
  }

  /**
   * Override the model vendor name here
   * @returns
   */
  async getModelSettings(): Promise<any> {
    const modelSettings = await super.getModelSettings();
    console.log("BAS Joule: the configured model settings are:");
    console.log(modelSettings);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- ignore
    return modelSettings;
  }

  /**
   * Override the startSession here, including attaching more info to the user context, and use a customized genie session
   * All the conversational chat messages for one specific matched file will be maintained in one GenieSession object
   * @param initialPrompt
   * @param userContext
   * @param activeEnv
   * @returns
   */
  async startSession(initialPrompt: string, userContext: UserContext, activeEnv: ActiveEnv): Promise<IGenieSession> {
    try {
      const profile = await this.getProfile();
      for (const metadataItem of profile.context.metadata) {
        const name = metadataItem.name;
        let contextValue = userContext[name];
        if (!contextValue) {
          contextValue = metadataItem.defaultValue;
        }
        userContext[name] = contextValue;
      }
    } catch (error) {
      console.error(error);
    }
    const genieSession = new ContinueGenieSession(this, initialPrompt, userContext, activeEnv);
    this.sessions.push(genieSession);
    return genieSession;
  }

  /**
   * The custom implementation for the user action `showResult` defined in profile
   * @param response
   * @param session
   * @returns
   */
  // async showResult(response: string, session: IGenieSession): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/require-await -- ignore
  async showResult(response: string): Promise<boolean> {
    if (response) {
      return true;
    }
    return false;
  }
}
