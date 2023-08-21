import { ContextItem, ContextItemId } from "../../../schema/FullState";

abstract class AbstractContinueGUIClientProtocol {
  abstract sendMainInput(input: string): void;

  abstract reverseToIndex(index: number): void;

  abstract sendRefinementInput(input: string, index: number): void;

  abstract sendStepUserInput(input: string, index: number): void;

  abstract onStateUpdate(state: any): void;

  abstract onAvailableSlashCommands(
    callback: (commands: { name: string; description: string }[]) => void
  ): void;

  abstract sendClear(): void;

  abstract retryAtIndex(index: number): void;

  abstract deleteAtIndex(index: number): void;

  abstract deleteContextWithIds(ids: ContextItemId[]): void;

  abstract setEditingAtIds(ids: string[]): void;

  abstract toggleAddingHighlightedCode(): void;

  abstract showLogsAtIndex(index: number): void;

  abstract selectContextItem(id: string, query: string): void;

  abstract loadSession(session_id?: string): void;

  abstract onReconnectAtSession(session_id: string): void;

  abstract editStepAtIndex(userInput: string, index: number): void;

  abstract saveContextGroup(title: string, contextItems: ContextItem[]): void;

  abstract selectContextGroup(id: string): void;

  abstract deleteContextGroup(id: string): void;
}

export default AbstractContinueGUIClientProtocol;
