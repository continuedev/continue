abstract class AbstractContinueGUIClientProtocol {
  abstract sendMainInput(input: string): void;

  abstract reverseToIndex(index: number): void;

  abstract sendRefinementInput(input: string, index: number): void;

  abstract sendStepUserInput(input: string, index: number): void;

  abstract onStateUpdate(state: any): void;
}

export default AbstractContinueGUIClientProtocol;
