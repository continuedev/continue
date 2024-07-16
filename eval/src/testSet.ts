import { TestSetItem } from "./TestSetItem.js";

const amplifiedDevRepo = "https://github.com/continuedev/amplified.dev";

// Need a way to specify specific snippets within files
export const testSet: TestSetItem[] = [
  {
    repo: amplifiedDevRepo,
    query: "How can I create an architecture of participation?",
    groundTruthFiles: ["index.md"],
  },
];
