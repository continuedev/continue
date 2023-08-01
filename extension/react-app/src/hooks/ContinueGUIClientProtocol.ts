import { ContextItemId } from "../../../schema/FullState";
import AbstractContinueGUIClientProtocol from "./AbstractContinueGUIClientProtocol";
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
    this.messenger = useVscodeMessagePassing
      ? new VscodeMessenger(serverUrlWithSessionId)
      : new WebsocketMessenger(serverUrlWithSessionId);

    this.messenger.onClose(() => {
      console.log("GUI -> IDE websocket closed");
    });
    this.messenger.onError((error) => {
      console.log("GUI -> IDE websocket error", error);
    });
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

  onAvailableSlashCommands(
    callback: (commands: { name: string; description: string }[]) => void
  ) {
    this.messenger.onMessageType("available_slash_commands", (data: any) => {
      if (data.commands) {
        callback(data.commands);
      }
    });
  }

  sendClear() {
    this.messenger.send("clear_history", {});
  }

  retryAtIndex(index: number) {
    this.messenger.send("retry_at_index", { index });
  }

  deleteAtIndex(index: number) {
    this.messenger.send("delete_at_index", { index });
  }

  deleteContextWithIds(ids: ContextItemId[]) {
    this.messenger.send("delete_context_with_ids", {
      ids: ids.map((id) => `${id.provider_title}-${id.item_id}`),
    });
  }

  setEditingAtIds(ids: string[]) {
    this.messenger.send("set_editing_at_ids", { ids });
  }

  toggleAddingHighlightedCode(): void {
    this.messenger.send("toggle_adding_highlighted_code", {});
  }

  showLogsAtIndex(index: number): void {
    this.messenger.send("show_logs_at_index", { index });
  }

  selectContextItem(id: string, query: string): void {
    this.messenger.send("select_context_item", { id, query });
  }
}

export default ContinueGUIClientProtocol;
