abstract class AbstractContinueGUIClientProtocol {
  abstract sendMainInput(input: string): void;

  abstract reverseToIndex(index: number): void;

  abstract sendRefinementInput(input: string, index: number): void;

  abstract sendStepUserInput(input: string, index: number): void;

  abstract onStateUpdate(state: any): void;

  abstract onAvailableSlashCommands(
    callback: (commands: { name: string; description: string }[]) => void
  ): void;

  abstract changeDefaultModel(model: string): void;

  abstract sendClear(): void;

  abstract retryAtIndex(index: number): void;

  abstract deleteAtIndex(index: number): void;

  abstract deleteContextAtIndices(indices: number[]): void;

  abstract setEditingAtIndices(indices: number[]): void;

  abstract setPinnedAtIndices(indices: number[]): void;

  abstract toggleAddingHighlightedCode(): void;
}

export default AbstractContinueGUIClientProtocol;
