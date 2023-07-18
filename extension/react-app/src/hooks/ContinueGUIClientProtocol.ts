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

  changeDefaultModel(model: string) {
    this.messenger.send("change_default_model", { model });
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

  deleteContextAtIndices(indices: number[]) {
    this.messenger.send("delete_context_at_indices", { indices });
  }

  setEditingAtIndices(indices: number[]) {
    this.messenger.send("set_editing_at_indices", { indices });
  }

  setPinnedAtIndices(indices: number[]) {
    this.messenger.send("set_pinned_at_indices", { indices });
  }

  toggleAddingHighlightedCode(): void {
    this.messenger.send("toggle_adding_highlighted_code", {});
  }

  showLogsAtIndex(index: number): void {
    this.messenger.send("show_logs_at_index", { index });
  }
}

export default ContinueGUIClientProtocol;
