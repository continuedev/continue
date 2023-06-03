import AbstractContinueGUIClientProtocol from "./ContinueGUIClientProtocol";
// import { Messenger, WebsocketMessenger } from "../../../src/util/messenger";
import { Messenger, WebsocketMessenger } from "./messenger";
import { VscodeMessenger } from "./vscodeMessenger";

class ContinueGUIClientProtocol extends AbstractContinueGUIClientProtocol {
  messenger: Messenger;
  // Server URL must contain the session ID param
  serverUrlWithSessionId: string;

  constructor(
    serverUrlWithSessionId: string,
    useVscodeMessagePassing: boolean
  ) {
    super();
    this.serverUrlWithSessionId = serverUrlWithSessionId;
    if (useVscodeMessagePassing) {
      this.messenger = new VscodeMessenger(serverUrlWithSessionId);
    } else {
      this.messenger = new WebsocketMessenger(serverUrlWithSessionId);
    }
  }

  sendMainInput(input: string) {
    this.messenger.send("main_input", { input });
  }

  reverseToIndex(index: number) {
    this.messenger.send("reverse_to_index", { index });
  }

  sendRefinementInput(input: string, index: number) {
    this.messenger.send("refinement_input", { input, index });
  }

  sendStepUserInput(input: string, index: number) {
    this.messenger.send("step_user_input", { input, index });
  }

  onStateUpdate(callback: (state: any) => void) {
    this.messenger.onMessageType("state_update", (data: any) => {
      if (data.state) {
        callback(data.state);
      }
    });
  }

  retryAtIndex(index: number) {
    this.messenger.send("retry_at_index", { index });
  }
}

export default ContinueGUIClientProtocol;
