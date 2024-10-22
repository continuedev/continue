/**
 * We follow the policy of only completing bracket pairs that we started
 * But sometimes we started the pair in a previous autocomplete suggestion
 */
export class BracketMatchingService {
  private openingBracketsFromLastCompletion: string[] = [];
  private lastCompletionFile: string | undefined = undefined;

  static BRACKETS: { [key: string]: string } = { "(": ")", "{": "}", "[": "]" };
  static BRACKETS_REVERSE: { [key: string]: string } = {
    ")": "(",
    "}": "{",
    "]": "[",
  };

  handleAcceptedCompletion(completion: string, filepath: string) {
    this.openingBracketsFromLastCompletion = [];
    const stack: string[] = [];

    for (let i = 0; i < completion.length; i++) {
      const char = completion[i];
      if (Object.keys(BracketMatchingService.BRACKETS).includes(char)) {
        // It's an opening bracket
        stack.push(char);
      } else if (
        Object.values(BracketMatchingService.BRACKETS).includes(char)
      ) {
        // It's a closing bracket
        if (
          stack.length === 0 ||
          BracketMatchingService.BRACKETS[stack.pop()!] !== char
        ) {
          break;
        }
      }
    }

    // Any remaining opening brackets in the stack are uncompleted
    this.openingBracketsFromLastCompletion = stack;
    this.lastCompletionFile = filepath;
  }
}
