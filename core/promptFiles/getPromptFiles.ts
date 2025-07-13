import { DEFAULT_PROMPTS_FOLDER_V1 } from ".";
import { IDE } from "..";
import { walkDir } from "../indexing/walkDir";
import { readAllGlobalPromptFiles } from "../util/paths";
import { joinPathsToUri } from "../util/uri";

// The hardcoded init prompt content
const INIT_PROMPT_CONTENT = `name: Init
description: Initialize Codebase
---
You are an expert development assistant. Your task is to create a comprehensive CONTINUE.md project guide for the user's codebase to help them and their team better understand and work with the project.

## Step 1: Check Required Tools
First, verify that you have access to the necessary tools:
- builtin_file_glob_search: To discover project files
- builtin_read_file: To analyze file contents
- builtin_ls: To explore directory structure
- builtin_create_new_file: To generate the CONTINUE.md file

If any of these tools are unavailable, inform the user that they need to activate them and enable "Agent Mode" in Continue before proceeding.

## Step 2: Project Analysis
Analyze the project structure and key files to understand:
- The programming languages and frameworks used
- The overall architecture and organization
- Key components and their responsibilities
- Important configuration files
- Build/deployment system

## Step 3: Generate CONTINUE.md
Create a comprehensive CONTINUE.md file in the .continue/rules/ directory with the following sections:

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
After creating the .continue/rules/CONTINUE.md file, provide a summary of what you've created and remind the user to:
1. Review and edit the file as needed
2. Commit it to their repository to share with their team
3. Explain that Continue will automatically load this file into context when working with the project

Also inform the user that they can create additional rules.md files in subdirectories for more specific documentation related to those components.`;

export const DEFAULT_PROMPTS_FOLDER_V2 = ".continue/prompts";

export async function getPromptFilesFromDir(
  ide: IDE,
  dir: string,
): Promise<{ path: string; content: string }[]> {
  try {
    const exists = await ide.fileExists(dir);

    if (!exists) {
      return [];
    }

    const uris = await walkDir(dir, ide, {
      source: "get dir prompt files",
    });
    const promptFilePaths = uris.filter((p) => p.endsWith(".prompt"));
    const results = promptFilePaths.map(async (uri) => {
      const content = await ide.readFile(uri); // make a try catch
      return { path: uri, content };
    });
    return Promise.all(results);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getAllPromptFiles(
  ide: IDE,
  overridePromptFolder?: string,
  checkV1DefaultFolder: boolean = false,
): Promise<{ path: string; content: string }[]> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  let promptFiles: { path: string; content: string }[] = [];

  let dirsToCheck = [DEFAULT_PROMPTS_FOLDER_V2];
  if (checkV1DefaultFolder) {
    dirsToCheck.push(DEFAULT_PROMPTS_FOLDER_V1);
  }
  if (overridePromptFolder) {
    dirsToCheck = [overridePromptFolder];
  }

  const fullDirs = workspaceDirs
    .map((dir) => dirsToCheck.map((d) => joinPathsToUri(dir, d)))
    .flat();

  promptFiles = (
    await Promise.all(fullDirs.map((dir) => getPromptFilesFromDir(ide, dir)))
  ).flat();

  // Also read from ~/.continue/.prompts
  promptFiles.push(...readAllGlobalPromptFiles());

  // Add hardcoded init prompt
  promptFiles.push({
    path: "builtin:/init.prompt",
    content: INIT_PROMPT_CONTENT,
  });

  return await Promise.all(
    promptFiles.map(async (file) => {
      if (file.path.startsWith("builtin:")) {
        return file;
      }
      const content = await ide.readFile(file.path);
      return { path: file.path, content };
    }),
  );
}
