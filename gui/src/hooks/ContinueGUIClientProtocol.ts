import { ContextItem } from "../schema/ContextItem";
import { ContextItemId } from "../schema/ContextItemId";
import { ContinueConfig } from "../schema/ContinueConfig";
import { SessionState, StepDescription } from "../schema/SessionState";
import { SessionUpdate } from "../schema/SessionUpdate";
import AbstractContinueGUIClientProtocol from "./AbstractContinueGUIClientProtocol";
import { Messenger, SocketIOMessenger } from "./messenger";
import { VscodeMessenger } from "./vscodeMessenger";

class ContinueGUIClientProtocol extends AbstractContinueGUIClientProtocol {
  messenger?: Messenger;
  serverUrl: string;
  useVscodeMessagePassing: boolean;
  getSessionState: () => SessionState;

  onStateUpdateCallbacks: ((state: any) => void)[] = [];

  constructor(
    serverUrl: string,
    useVscodeMessagePassing: boolean,
    getSesionState: () => SessionState
  ) {
    super();
    this.serverUrl = serverUrl;
    this.useVscodeMessagePassing = useVscodeMessagePassing;
    this.getSessionState = getSesionState;

    this.serverUrl = serverUrl;
    this.useVscodeMessagePassing = useVscodeMessagePassing;
    this.messenger = useVscodeMessagePassing
      ? new VscodeMessenger(serverUrl)
      : new SocketIOMessenger(serverUrl);

    this.messenger.onClose(() => {
      console.log("GUI Connection closed: ", serverUrl);
    });
    this.messenger.onError((error) => {
      console.log("GUI Connection error: ", error);
    });
    this.messenger.onOpen(() => {
      console.log("GUI Connection opened: ", serverUrl);
    });

    this.messenger.onMessage((messageType, data, acknowledge) => {
      this.handleMessage(messageType, data, acknowledge);
    });
  }

  onConnected(callback: () => void) {
    this.messenger?.onOpen(callback);
  }

  handleMessage(
    messageType: string,
    data: any,
    acknowledge: (data: any) => void
  ) {
    switch (messageType) {
      case "state_update":
        if (data.state) {
          for (const callback of this.onStateUpdateCallbacks) {
            callback(data.state);
          }
        }
        break;
      case "get_session_state":
        const sessionState = this.getSessionState();
        acknowledge({
          history: sessionState.history,
          context_items: sessionState.context_items,
        });
        break;
      default:
        break;
    }
  }

  loadSession(session_id?: string): void {
    this.messenger?.send("load_session", { session_id });
  }

  sendMainInput(input: string) {
    this.messenger?.send("main_input", { input });
  }

  runFromState(sessionState: SessionState) {
    this.messenger?.send("run_from_state", { state: sessionState });
  }

  async getSessionTitle(history: StepDescription[]): Promise<string> {
    return await this.messenger?.sendAndReceive("get_session_title", {
      history,
    });
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

  onSessionUpdate(callback: (update: SessionUpdate) => void) {
    this.messenger?.onMessageType("session_update", (data: SessionUpdate) => {
      callback(data);
    });
  }

  onConfigUpdate(callback: (config: ContinueConfig) => void) {
    this.messenger?.onMessageType("config_update", (data: any) => {
      callback(data);
    });
  }

  getConfig(): Promise<ContinueConfig> {
    return this.messenger?.sendAndReceive("get_config", {});
  }

  onAddContextItem(callback: (item: ContextItem) => void) {
    this.messenger?.onMessageType("add_context_item", (data: ContextItem) => {
      callback(data);
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

  stopSession() {
    this.messenger?.send("stop_session", {});
  }

  sendClear() {
    this.messenger?.send("clear_history", {});
  }

  retryAtIndex(index: number) {
    this.messenger?.send("retry_at_index", { index });
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

  showContextVirtualFile(index?: number): void {
    this.messenger?.send("show_context_virtual_file", { index });
  }

  selectContextItem(id: string, query: string): void {
    this.messenger?.send("select_context_item", { id, query });
  }

  async getContextItem(id: string, query: string): Promise<ContextItem> {
    return await this.messenger?.sendAndReceive("get_context_item", {
      id,
      query,
    });
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

  setSystemMessage(system_message: string): void {
    this.messenger?.send("set_system_message", { system_message });
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
}

export default ContinueGUIClientProtocol;
