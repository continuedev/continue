import fs from "node:fs";
import path from "node:path";

import Mock from "../../../llm/llms/Mock";
import { testConfigHandler, testIde } from "../../../test/util/fixtures";
import { CompletionProvider } from "../../CompletionProvider";
import { AutocompleteInput } from "../../util/types";

const FIM_DELIMITER = "<|fim|>";

function parseFimExample(text: string): { prefix: string; suffix: string } {
  const [prefix, suffix] = text.split(FIM_DELIMITER);
  return { prefix, suffix };
}

export interface AutocompleteFileringTestInput {
  description: string;
  filename: string;
  input: string;
  llmOutput: string;
  expectedCompletion: string | null;
  options?: {
    only?: boolean;
  };
}

export async function testAutocompleteFiltering(
  test: AutocompleteFileringTestInput,
) {
  const { prefix, suffix } = parseFimExample(test.input);

  // Setup necessary objects
  const llm = new Mock({
    model: "mock",
  });
  llm.completion = test.llmOutput;
  const ide = testIde;
  const configHandler = testConfigHandler;

  // Create a real file
  const [workspaceDir] = await ide.getWorkspaceDirs();
  const filepath = path.join(workspaceDir, test.filename);
  fs.writeFileSync(filepath, test.input.replace(FIM_DELIMITER, ""));

  // Prepare completion input and provider
  const completionProvider = new CompletionProvider(
    configHandler,
    ide,
    async () => llm,
    () => {},
    async () => [],
  );

  const line = prefix.split("\n").length - 1;
  const character = prefix.split("\n")[line].length;
  const autocompleteInput: AutocompleteInput = {
    clipboardText: "",
    completionId: "test-completion-id",
    filepath,
    pos: {
      line,
      character,
    },
    recentlyEditedFiles: [],
    recentlyEditedRanges: [],
  };

  // Generate a completion
  const result = await completionProvider.provideInlineCompletionItems(
    autocompleteInput,
    undefined,
  );

  // Ensure that we return the text that is wanted to be displayed
  expect(result?.completion).toEqual(test.expectedCompletion);
}
