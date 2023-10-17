import { ContextItem, ContextItemId } from "../../../schema/FullState";
import AbstractContinueGUIClientProtocol from "./AbstractContinueGUIClientProtocol";
import { Messenger, WebsocketMessenger } from "./messenger";
import { VscodeMessenger } from "./vscodeMessenger";

class ContinueGUIClientProtocol extends AbstractContinueGUIClientProtocol {
  messenger?: Messenger;
  // Server URL must contain the session ID param
  serverUrlWithSessionId: string;
  useVscodeMessagePassing: boolean;

  onStateUpdateCallbacks: ((state: any) => void)[] = [];

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
      console.log("GUI Connection closed: ", serverUrlWithSessionId);
    });
    this.messenger.onError((error) => {
      console.log("GUI Connection error: ", error);
    });
    this.messenger.onOpen(() => {
      console.log("GUI Connection opened: ", serverUrlWithSessionId);
    });

    this.messenger.onMessageType("reconnect_at_session", (data: any) => {
      if (data.session_id) {
        this.onReconnectAtSession(data.session_id);
      }
    });

    this.messenger.onMessageType("state_update", (data: any) => {
      if (data.state) {
        for (const callback of this.onStateUpdateCallbacks) {
          callback(data.state);
        }
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
    const urlToReconnect = `${
      this.serverUrlWithSessionId.split("?")[0]
    }?session_id=${session_id}`;
    console.log("Reconnecting at session: ", urlToReconnect);
    this.connectMessenger(urlToReconnect, this.useVscodeMessagePassing);
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
    this.onStateUpdateCallbacks.push(callback);
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

  deleteContextWithIds(ids: ContextItemId[], index?: number) {
    this.messenger?.send("delete_context_with_ids", {
      ids: ids.map((id) => `${id.provider_title}-${id.item_id}`),
      index,
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

  showContextVirtualFile(index?: number): void {
    this.messenger?.send("show_context_virtual_file", { index });
  }

  selectContextItem(id: string, query: string): void {
    this.messenger?.send("select_context_item", { id, query });
  }

  selectContextItemAtIndex(id: string, query: string, index: number): void {
    this.messenger?.send("select_context_item_at_index", {
      id,
      query,
      index,
    });
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

  addModelForRole(role: string, model_class: string, model: any): void {
    this.messenger?.send("add_model_for_role", { role, model, model_class });
  }

  setModelForRoleFromIndex(role: string, index: number): void {
    this.messenger?.send("set_model_for_role_from_index", { role, index });
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

  setCurrentSessionTitle(title: string): void {
    this.messenger?.send("set_current_session_title", { title });
  }
}

export default ContinueGUIClientProtocol;
