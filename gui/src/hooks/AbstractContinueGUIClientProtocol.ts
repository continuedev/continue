import { ContextItem } from "../schema/ContextItem";
import { ContextItemId } from "../schema/ContextItemId";
import { ContinueConfig } from "../schema/ContinueConfig";

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

  abstract deleteContextWithIds(ids: ContextItemId[], index?: number): void;

  abstract setEditingAtIds(ids: string[]): void;

  abstract toggleAddingHighlightedCode(): void;

  abstract showContextVirtualFile(): void;

  abstract selectContextItem(id: string, query: string): void;

  abstract getContextItem(id: string, query: string): Promise<ContextItem>;

  abstract selectContextItemAtIndex(
    id: string,
    query: string,
    index: number
  ): void;

  abstract loadSession(session_id?: string): void;

  abstract editStepAtIndex(userInput: string, index: number): void;

  abstract setSystemMessage(message: string): void;

  abstract setTemperature(temperature: number): void;

  abstract addModelForRole(
    role: string,
    model_class: string,
    model: string
  ): void;

  abstract saveContextGroup(title: string, contextItems: ContextItem[]): void;

  abstract selectContextGroup(id: string): void;

  abstract deleteContextGroup(id: string): void;

  abstract onConfigUpdate(callback: (config: ContinueConfig) => void);
}

export default AbstractContinueGUIClientProtocol;
