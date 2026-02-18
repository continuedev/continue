import { type AssistantConfig } from "@continuedev/sdk";
import { createRelativeRuleFilePath } from "core/config/markdown/utils.js";

import { SlashCommandResult } from "../ui/hooks/useChat.types.js";

function createInitPrompt(): string {
  const relativeRuleFilepath = createRelativeRuleFilePath("review");
  return `Please analyze this repository and create a comprehensive AGENTS.md file, along with a custom slash command. Use your available tools to understand the project structure, read important files like README.md, package.json, requirements.txt, and other configuration files to understand the technology stack and setup.

Create an AGENTS.md file with the following structure:

# Repository Overview

## Project Description
- What this project does
- Main purpose and goals  
- Key technologies used

## Architecture Overview
- High-level architecture
- Main components and their relationships
- Data flow and system interactions

## Directory Structure
- Important directories and their purposes
- Key files and configuration
- Entry points and main modules

## Development Workflow
- How to build/run the project
- Testing approach
- Development environment setup
- Lint and format commands

Additionally, create a slash command file at ${relativeRuleFilepath} with the following structure:

\`\`\`md
---
invokable: true
---

Review this code for potential issues, including:

<insert custom things to look for based on the repository details you find>

Provide specific, actionable feedback for improvements.
\`\`\`

This slash command will be invokable using /review and will provide instructions for code review tasks common to this repository.

Please create both the AGENTS.md file and the .continue/rules/review.md file using the Write tool after analyzing the repository. Focus on providing actionable information that would help both AI agents and human developers understand and work effectively with this codebase. Keep the files concise but informational.`;
}

export async function handleInit(
  _args: string[],
  _assistant: AssistantConfig,
): Promise<SlashCommandResult> {
  const prompt = createInitPrompt();

  return {
    newInput: prompt,
  };
}
