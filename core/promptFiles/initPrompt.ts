import { SlashCommandWithSource } from "..";
import { RULES_MARKDOWN_FILENAME } from "../llm/rules/constants";
import { BuiltInToolNames } from "../tools/builtIn";

const initFilename = "CONTINUE.md";

// Prompt for init slash command
export const INIT_PROMPT_CONTENT = `
You are an expert development assistant. Your task is to create a comprehensive ${initFilename} project guide for the user's codebase to help them and their team better understand and work with the project.

## Step 1: Check Required Tools
First, verify that you have access to the necessary tools:
- ${BuiltInToolNames.FileGlobSearch}: To discover project files
- ${BuiltInToolNames.ReadFile}: To analyze file contents
- ${BuiltInToolNames.LSTool}: To explore directory structure
- ${BuiltInToolNames.CreateNewFile}: To generate the ${initFilename} file

If any of these tools are unavailable, inform the user that they need to activate them and enable "Agent Mode" in Continue before proceeding.

## Step 2: Project Analysis
Analyze the project structure and key files to understand:
- The programming languages and frameworks used
- The overall architecture and organization
- Key components and their responsibilities
- Important configuration files
- Build/deployment system

## Step 3: Generate ${initFilename}
Create a comprehensive ${initFilename} file in the .continue/rules/ directory with the following sections:

1. **Project Overview**
   - Brief description of the project's purpose
   - Key technologies used
   - High-level architecture

2. **Getting Started**
   - Prerequisites (required software, dependencies)
   - Installation instructions
   - Basic usage examples
   - Running tests

3. **Project Structure**
   - Overview of main directories and their purpose
   - Key files and their roles
   - Important configuration files

4. **Development Workflow**
   - Coding standards or conventions
   - Testing approach
   - Build and deployment process
   - Contribution guidelines

5. **Key Concepts**
   - Domain-specific terminology
   - Core abstractions
   - Design patterns used

6. **Common Tasks**
   - Step-by-step guides for frequent development tasks
   - Examples of common operations

7. **Troubleshooting**
   - Common issues and their solutions
   - Debugging tips

8. **References**
   - Links to relevant documentation
   - Important resources

Make sure your analysis is thorough but concise. Focus on information that would be most helpful to developers working on the project. If certain information isn't available from the codebase, make reasonable assumptions but mark these sections as needing verification.

## Step 4: Finalize
After creating the .continue/rules/${initFilename} file, provide a summary of what you've created and remind the user to:
1. Review and edit the file as needed
2. Commit it to their repository to share with their team
3. Explain that Continue will automatically load this file into context when working with the project

Also inform the user that they can create additional ${RULES_MARKDOWN_FILENAME} files in subdirectories for more specific documentation related to those components.
`.trim();

export const initSlashCommand: SlashCommandWithSource = {
  name: "Init",
  description: "Initialize Codebase",
  source: "built-in",
  prompt: INIT_PROMPT_CONTENT,
};
