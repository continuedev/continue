import fs from "node:fs";

import { LLMLogger } from "core/llm/logger";
import { LLMLogFormatter } from "core/llm/logFormatter";
import { getPromptLogsPath } from "core/util/paths";

export function setupPromptLogging(llmLogger: LLMLogger) {
  const promptLogsPath = getPromptLogsPath();
  const output = fs.createWriteStream(promptLogsPath);

  new LLMLogFormatter(llmLogger, output);

  return {
    dispose() {
      output.end();
    },
  };
}
