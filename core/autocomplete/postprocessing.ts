import type { ILLM } from "../index.js";
import { longestCommonSubsequence } from "../util/lcs.js";
import { lineIsRepeated } from "./streamTransforms/lineStream.js";

function rewritesLineAbove(completion: string, prefix: string): boolean {
  const lineAbove = prefix
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(-1)[0];
  if (!lineAbove) {
    return false;
  }

  const firstLineOfCompletion = completion
    .split("\n")
    .find((line) => line.trim().length > 0);
  if (!firstLineOfCompletion) {
    return false;
  }
  return lineIsRepeated(lineAbove, firstLineOfCompletion);
}

const MAX_REPETITION_FREQ_TO_CHECK = 3;
function isExtremeRepetition(completion: string): boolean {
  const lines = completion.split("\n");
  if (lines.length < 6) {
    return false;
  }
  for (let freq = 1; freq < MAX_REPETITION_FREQ_TO_CHECK; freq++) {
    const lcs = longestCommonSubsequence(lines[0], lines[freq]);
    if (lcs.length > 5 || lcs.length > lines[0].length * 0.5) {
      let matchCount = 0;
      for (let i = 0; i < lines.length; i += freq) {
        if (lines[i].includes(lcs)) {
          matchCount++;
        }
      }
      if (matchCount * freq > 8 || (matchCount * freq) / lines.length > 0.8) {
        return true;
      }
    }
  }
  return false;
}

export function postprocessCompletion({
  completion,
  llm,
  prefix,
  suffix,
  configHandler
}: {
  completion: string;
  llm: ILLM;
  prefix: string;
  suffix: string;
  configHandler:any
}): string | undefined {
  // Don't return empty
  if (completion.trim().length <= 0) {
    configHandler.logMessage(
      // "Document Path: /ai4math/users/xmlu/continue_env/continue/core/autocomplete/postprocessing.ts\n"
      "后处理：补全结果为空，返回 undefined\n"
    )
    return undefined;
  }

  // Dont return if it's just a repeat of the line above
  if (rewritesLineAbove(completion, prefix)) {
    const secondLineAndAfterOfCompletion = completion
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .slice(1)  // 获取第二个及以后的非空行
      .join("\n");  // 将数组转换为字符串，以换行符连接
    // configHandler.logMessage(
    //   // "Document Path: /ai4math/users/xmlu/continue_env/continue/core/autocomplete/postprocessing.ts\n"
    //   + "后处理：如果只是重复上面的一行，返回 secondLineAndAfterOfCompletion："+secondLineAndAfterOfCompletion+"\n"
    //   + "completion: "+completion+"\n"
    // )
    if (secondLineAndAfterOfCompletion == undefined) return undefined;
    else completion = secondLineAndAfterOfCompletion;
  }

  // Filter out repetitions of many lines in a row
  if (isExtremeRepetition(completion)) {
    // configHandler.logMessage(
    //   "Document Path: /ai4math/users/xmlu/continue_env/continue/core/autocomplete/postprocessing.ts\n"
    //   + "后处理：连续多行的重复内容，返回 undefined\n"
    // )
    return undefined;
  }

  // Remove trailing whitespace
  completion = completion.trimEnd();



  if (llm.model.includes("codestral")) {
    // Codestral sometimes starts with an extra space
    if (completion[0] === " " && completion[1] !== " ") {
      if (prefix.endsWith(" ") && suffix.startsWith("\n")) {
        completion = completion.slice(1);
      }
    }
  }

  // If completion starts with multiple whitespaces, but the cursor is at the end of the line
  // then it should probably be on a new line
  if (
    (completion.startsWith("  ") || completion.startsWith("\t")) &&
    !(prefix.endsWith("\n") ||prefix.endsWith("\t")||prefix.endsWith("  ")) &&
    (suffix.startsWith("\n") || suffix.trim().length === 0)
  ) {
    // configHandler.logMessage(
    //   "Document Path: /ai4math/users/xmlu/continue_env/continue/core/autocomplete/postprocessing.ts\n"
    //   + "后处理：如果补全以多个空格开始，但光标位于行尾, 那么可能应该换行，返回undefined\n"
    //   + "前缀以" + prefix.charCodeAt(prefix.length - 1) + "结束\n"
    // )
    // completion = "\n" + completion;
    return undefined;
  }
  // If prefix ends with space and so does completion, then remove the space from completion
  if (prefix.endsWith(" ") && completion.startsWith(" ")) {
    completion = completion.slice(1);
  }

  // Qwen often adds an extra space to the start
  if (llm.model.toLowerCase().includes("qwen") && completion.startsWith(" ")) {
    completion = completion.slice(1);
  }
  // 新增后处理
  if (prefix.endsWith("\t")||prefix.endsWith("  ")) {
    completion = completion.trim();
  }
  return completion
}
