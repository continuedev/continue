import { shouldExclude } from "./exclusionUtils";
import {
  buildCommitMessageContext,
  type CommitMessageContextInput,
} from "./commitMessageContext";

const DEFAULT_PROMPT_TEMPLATE = `# Conventional Commit Message Generator
## System Instructions
You are an expert Git commit message generator that creates conventional commit messages based on staged changes.
Analyze the provided git diff output and generate an appropriate conventional commit message following the specification.

## CRITICAL: Commit Message Output Rules
- DO NOT include any internal status indicators or bracketed metadata (e.g. "[Status: Active]", "[Context: Missing]")
- DO NOT include task-specific formatting artifacts from other rules
- DO NOT wrap the message in quotes or code fences
- Return ONLY the commit message in the conventional format, nothing else

## Conventional Commits Format
Generate commit messages following this exact structure:
<type>[optional scope]: <description>
[optional body]
[optional footer(s)]

### Core Types
- feat: New feature or functionality
- fix: Bug fix

### Additional Types
- docs: Documentation changes only
- style: Formatting only (whitespace, etc.)
- refactor: Code change that neither fixes a bug nor adds a feature
- perf: Performance improvement
- test: Adding or fixing tests
- build: Build system or external dependencies
- ci: CI/CD changes
- chore: Maintenance tasks
- revert: Revert a previous commit

### Description Rules
- Use imperative mood ("add" not "added")
- Start with a lowercase letter
- No period at the end
- Keep the subject concise

Return ONLY the commit message.`;

const PATCH_DIFF_HEADER = /^diff --git a\/[^\s]+ b\/(?<target>[^\s]+)/m;

export class CommitMessageGenerator {
  private previousGitContext: string | null = null;
  private previousCommitMessage: string | null = null;

  async generateCommitMessage(
    configHandler: any,
    opts?: CommitMessageContextInput,
  ): Promise<string> {
    const { config } = await configHandler.loadConfig();

    if (!config) {
      throw new Error("Failed to load config for commit message generation");
    }

    const llm = config.selectedModelByRole?.commitMessage;

    if (!llm) {
      throw new Error(
        "No commitMessage model selected. Configure config.selectedModelByRole.commitMessage.",
      );
    }

    if (!opts || opts.diffs === undefined || opts.branch === undefined) {
      throw new Error(
        "Diffs and branch are required for commit message generation",
      );
    }

    const gitContext = this.buildGitContext(opts);
    const prompt = this.buildPrompt(gitContext, llm);
    const messages = [{ role: "user", content: prompt }];

    let fullResponse = "";
    for await (const chunk of llm.streamChat(messages)) {
      fullResponse += chunk?.content ?? "";
    }

    const commitMessage = this.extractCommitMessage(fullResponse);
    this.previousGitContext = gitContext;
    this.previousCommitMessage = commitMessage;

    return commitMessage;
  }

  buildGitContext(input: CommitMessageContextInput): string {
    const filteredDiffs = (input.diffs ?? []).filter((diff) => {
      const headerMatch = PATCH_DIFF_HEADER.exec(diff);
      const targetPath = headerMatch?.groups?.target;

      if (!targetPath) {
        return true;
      }

      return !shouldExclude(targetPath);
    });

    return buildCommitMessageContext({
      ...input,
      diffs: filteredDiffs,
    });
  }

  buildPrompt(gitContext: string, llm: any): string {
    const basePrompt =
      llm?.promptTemplates?.commitMessage ?? DEFAULT_PROMPT_TEMPLATE;
    let prompt = `${basePrompt.trim()}\n\n${gitContext}`;

    if (
      gitContext === this.previousGitContext &&
      this.previousCommitMessage?.trim().length
    ) {
      prompt += `\n\n# CRITICAL INSTRUCTION: GENERATE A COMPLETELY DIFFERENT COMMIT MESSAGE\nThe user has requested a new commit message for the same changes.\nThe previous message was: "${this.previousCommitMessage}"\nYOU MUST create a message that is COMPLETELY DIFFERENT by:\n- Using entirely different wording and phrasing\n- Focusing on different aspects of the changes\n- Using a different structure or format if appropriate\nThis is the MOST IMPORTANT requirement for this task.`;
    }

    return prompt;
  }

  extractCommitMessage(response: string): string {
    const trimmedResponse = response.trim();
    const fencedOnlyMatch = /^```(?:[\w-]+)?\s*\n?([\s\S]*?)\n?```$/.exec(
      trimmedResponse,
    );

    let cleaned =
      fencedOnlyMatch?.[1] ??
      trimmedResponse.replace(/```(?:[\w-]+)?\s*\n?/g, "").replace(/```/g, "");

    cleaned = cleaned.trim();

    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    return cleaned;
  }
}
