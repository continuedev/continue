import { ContextItem, ContextItemId } from "../../../schema/FullState";
import AbstractContinueGUIClientProtocol from "./AbstractContinueGUIClientProtocol";
import { Messenger, WebsocketMessenger } from "./messenger";
import { VscodeMessenger } from "./vscodeMessenger";

class ContinueGUIClientProtocol extends AbstractContinueGUIClientProtocol {
  messenger?: Messenger;
  // Server URL must contain the session ID param
  serverUrlWithSessionId: string;
  useVscodeMessagePassing: boolean;

  private connectMessenger(
    serverUrlWithSessionId: string,
    useVscodeMessagePassing: boolean
  ) {
    if (this.messenger) {
      console.log("Closing session: ", this.serverUrlWithSessionId);
      this.messenger.close();
    }
    this.serverUrlWithSessionId = serverUrlWithSessionId;
    this.useVscodeMessagePassing = useVscodeMessagePassing;
    this.messenger = useVscodeMessagePassing
      ? new VscodeMessenger(serverUrlWithSessionId)
      : new WebsocketMessenger(serverUrlWithSessionId);

    this.messenger.onClose(() => {
      console.log("GUI -> IDE websocket closed");
    });
    this.messenger.onError((error) => {
      console.log("GUI -> IDE websocket error", error);
    });

    this.messenger.onMessageType("reconnect_at_session", (data: any) => {
      if (data.session_id) {
        this.onReconnectAtSession(data.session_id);
      }
    });
  }

  constructor(
    serverUrlWithSessionId: string,
    useVscodeMessagePassing: boolean
  ) {
    super();
    this.serverUrlWithSessionId = serverUrlWithSessionId;
    this.useVscodeMessagePassing = useVscodeMessagePassing;
    this.connectMessenger(serverUrlWithSessionId, useVscodeMessagePassing);
  }

  loadSession(session_id?: string): void {
    this.messenger?.send("load_session", { session_id });
  }

  onReconnectAtSession(session_id: string): void {
    this.connectMessenger(
      `${this.serverUrlWithSessionId.split("?")[0]}?session_id=${session_id}`,
      this.useVscodeMessagePassing
    );
  }

  sendMainInput(input: string) {
    this.messenger?.send("main_input", { input });
  }

  reverseToIndex(index: number) {
    this.messenger?.send("reverse_to_index", { index });
  }

  sendRefinementInput(input: string, index: number) {
    this.messenger?.send("refinement_input", { input, index });
  }

  sendStepUserInput(input: string, index: number) {
    this.messenger?.send("step_user_input", { input, index });
  }

  onStateUpdate(callback: (state: any) => void) {
    this.messenger?.onMessageType("state_update", (data: any) => {
      if (data.state) {
        callback(data.state);
      }
    });
  }

  onAvailableSlashCommands(
    callback: (commands: { name: string; description: string }[]) => void
  ) {
    this.messenger?.onMessageType("available_slash_commands", (data: any) => {
      if (data.commands) {
        callback(data.commands);
      }
    });
  }

  sendClear() {
    this.messenger?.send("clear_history", {});
  }

  retryAtIndex(index: number) {
    this.messenger?.send("retry_at_index", { index });
  }

  deleteAtIndex(index: number) {
    this.messenger?.send("delete_at_index", { index });
  }

  deleteContextWithIds(ids: ContextItemId[]) {
    this.messenger?.send("delete_context_with_ids", {
      ids: ids.map((id) => `${id.provider_title}-${id.item_id}`),
    });
  }

  setEditingAtIds(ids: string[]) {
    this.messenger?.send("set_editing_at_ids", { ids });
  }

  toggleAddingHighlightedCode(): void {
    this.messenger?.send("toggle_adding_highlighted_code", {});
  }

  showLogsAtIndex(index: number): void {
    this.messenger?.send("show_logs_at_index", { index });
  }

  selectContextItem(id: string, query: string): void {
    this.messenger?.send("select_context_item", { id, query });
  }

  editStepAtIndex(userInput: string, index: number): void {
    this.messenger?.send("edit_step_at_index", {
      user_input: userInput,
      index,
    });
  }

  setSystemMessage(message: string): void {
    this.messenger?.send("set_system_message", { message });
  }

  setTemperature(temperature: number): void {
    this.messenger?.send("set_temperature", { temperature });
  }

  setModelForRole(role: string, model_class: string, model: any): void {
    this.messenger?.send("set_model_for_role", { role, model, model_class });
  }

  saveContextGroup(title: string, contextItems: ContextItem[]): void {
    this.messenger?.send("save_context_group", {
      context_items: contextItems,
      title,
    });
  }

  selectContextGroup(id: string): void {
    this.messenger?.send("select_context_group", { id });
  }

  deleteContextGroup(id: string): void {
    this.messenger?.send("delete_context_group", { id });
  }
}

export default ContinueGUIClientProtocol;
