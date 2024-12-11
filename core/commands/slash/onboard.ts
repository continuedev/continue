import * as fs from "fs/promises";
import * as path from "path";

import ignore from "ignore";

import { IDE, SlashCommand } from "../..";
import {
  defaultIgnoreDir,
  defaultIgnoreFile,
  gitIgArrayFromFile,
} from "../../indexing/ignore";
import { renderChatMessage } from "../../util/messageContent";

const LANGUAGE_DEP_MGMT_FILENAMES = [
  "package.json", // JavaScript (Node.js)
  "requirements.txt", // Python
  "Gemfile", // Ruby
  "pom.xml", // Java (Maven)
  "build.gradle", // Java (Gradle)
  "composer.json", // PHP
  "Cargo.toml", // Rust
  "go.mod", // Go
  "packages.config", // C# (.NET)
  "*.csproj", // C# (.NET Core)
  "pubspec.yaml", // Dart
  "Project.toml", // Julia
  "mix.exs", // Elixir
  "rebar.config", // Erlang
  "shard.yml", // Crystal
  "Package.swift", // Swift
  "dependencies.gradle", // Kotlin (when using Gradle)
  "Podfile", // Objective-C/Swift (CocoaPods)
  "*.cabal", // Haskell
  "dub.json", // D
];

const MAX_EXPLORE_DEPTH = 2;

const OnboardSlashCommand: SlashCommand = {
  name: "onboard",
  description: "Familiarize yourself with the codebase",
  run: async function* ({ llm, ide }) {
    const [workspaceDir] = await ide.getWorkspaceDirs();

    const context = await gatherProjectContext(workspaceDir, ide);
    const prompt = createOnboardingPrompt(context);

    for await (const chunk of llm.streamChat(
      [{ role: "user", content: prompt }],
      new AbortController().signal,
    )) {
      yield renderChatMessage(chunk);
    }
  },
};

async function getEntriesFilteredByIgnore(dir: string, ide: IDE) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  let ig = ignore().add(defaultIgnoreDir).add(defaultIgnoreFile);

  const gitIgnorePath = path.join(dir, ".gitignore");

  const hasIgnoreFile = await fs
    .access(gitIgnorePath)
    .then(() => true)
    .catch(() => false);

  if (hasIgnoreFile) {
    const gitIgnore = await ide.readFile(gitIgnorePath);
    const igPatterns = gitIgArrayFromFile(gitIgnore);

    ig = ig.add(igPatterns);
  }

  const filteredEntries = entries.filter((entry) => {
    const name = entry.isDirectory() ? `${entry.name}/` : entry.name;
    return !ig.ignores(name);
  });

  return filteredEntries;
}

async function gatherProjectContext(
  workspaceDir: string,
  ide: IDE,
): Promise<string> {
  let context = "";

  async function exploreDirectory(dir: string, currentDepth: number = 0) {
    if (currentDepth > MAX_EXPLORE_DEPTH) {
      return;
    }

    const entries = await getEntriesFilteredByIgnore(dir, ide);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(workspaceDir, fullPath);

      if (entry.isDirectory()) {
        context += `\nFolder: ${relativePath}\n`;
        await exploreDirectory(fullPath, currentDepth + 1);
      } else {
        if (entry.name.toLowerCase() === "readme.md") {
          const content = await fs.readFile(fullPath, "utf-8");
          context += `README for ${relativePath}:\n${content}\n\n`;
        } else if (LANGUAGE_DEP_MGMT_FILENAMES.includes(entry.name)) {
          const content = await fs.readFile(fullPath, "utf-8");
          context += `${entry.name} for ${relativePath}:\n${content}\n\n`;
        }
      }
    }
  }

  await exploreDirectory(workspaceDir);

  return context;
}

function createOnboardingPrompt(context: string): string {
  return `
    As a helpful AI assistant, your task is to onboard a new developer to this project.
    Use the following context about the project structure, READMEs, and dependency files to create a comprehensive overview:

    ${context}

    Please provide an overview of the project with the following guidelines:
    - Determine the most important folders in the project, at most 10
    - Go through each important folder step-by-step:
      - Explain what each folder does in isolation by summarzing the README or package.json file, if available
      - Mention the most popular or common packages used in that folder and their roles.
    - After covering individual folders, zoom out to explain at most 5 high-level insights about the project's architecture:
      - How different parts of the codebase fit together.
      - The overall project architecture or design patterns evident from the folder structure and dependencies.
    - Provide at most 5 additional insights on the project's architecture that weren't covered in the folder-by-folder breakdown.

    Your response should be structured, clear, and focused on giving the new developer both a detailed understanding of individual components and a high-level overview of the project as a whole.

    Here is an example of a valid response:

    ## Important folders

    ### /folder1
    - Description: Contains the main application logic.
    - Key packages: Express.js for routing, Mongoose for database operations.

    #### /folder1/folder2

    ## Project Architecture
    - The frontend is built using React and Redux for state management.
    - The backend is a Node.js application using Express.js for routing and Mongoose for database operations.
    - The application follows a Model-View-Controller (MVC) architecture.

    ## Additional Insights
    - The project is using a monorepo structure.
    - The project uses TypeScript for type checking.
  `;
}

export default OnboardSlashCommand;
