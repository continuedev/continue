import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { NodeHtmlMarkdown } from "node-html-markdown";

import { BaseContextProvider } from "../";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { fetchFavicon } from "../../util/fetchFavicon";
import { getContinueGlobalPath } from "../../util/paths";

class URLContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "url",
    displayTitle: "URL",
    description: "Reference a webpage at a given URL",
    type: "query",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    try {
      // Check if the query is a GitHub repository URL
      if (this.isGitHubRepoUrl(query)) {
        return await this.handleGitHubRepo(query, extras);
      }

      const url = new URL(query);
      const icon = await fetchFavicon(url);
      const resp = await extras.fetch(url);
      const html = await resp.text();

      const dom = new JSDOM(html);
      let reader = new Readability(dom.window.document);
      let article = reader.parse();
      const content = article?.content || "";
      const markdown = NodeHtmlMarkdown.translate(
        content,
        {},
        undefined,
        undefined,
      );

      const title = article?.title || url.pathname;

      return [
        {
          icon,
          description: url.toString(),
          content: markdown,
          name: title,
          uri: {
            type: "url",
            value: url.toString(),
          },
        },
      ];
    } catch (e) {
      console.log(e);
      return [];
    }
  }

  private isGitHubRepoUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return (
        parsedUrl.hostname === "github.com" &&
        parsedUrl.pathname.split("/").filter(Boolean).length >= 2
      );
    } catch (e) {
      return false;
    }
  }

  private async handleGitHubRepo(
    url: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    try {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split("/").filter(Boolean);

      if (pathParts.length < 2) {
        throw new Error("Invalid GitHub repository URL");
      }

      const owner = pathParts[0];
      const repo = pathParts[1];
      const repoPath = `${owner}/${repo}`;
      const repoFileName = `${owner}@${repo}`;

      // Check if URL points to a specific file
      let filePath = "";
      if (
        pathParts.length > 3 &&
        (pathParts[2] === "blob" || pathParts[2] === "tree")
      ) {
        // Format: github.com/owner/repo/blob/branch/path/to/file
        // or: github.com/owner/repo/tree/branch/path/to/directory
        filePath = pathParts.slice(4).join("/");
      }

      // Execute repomix command to get repository markdown
      const { exec } = require("child_process");
      const util = require("util");
      const fs = require("fs");
      const path = require("path");
      const execPromise = util.promisify(exec);
      const readFilePromise = util.promisify(fs.readFile);

      const outPath = path.join(getContinueGlobalPath(), "out");

      // Run repomix command to generate the markdown file
      const command = `npx repomix --output ${outPath}/${repoFileName} --remote ${repoPath} --style markdown`;
      await execPromise(command);

      // Read the generated markdown file
      const outputFilePath = path.resolve(outPath, repoFileName);
      const markdownContent = await readFilePromise(outputFilePath, "utf8");

      const icon = await fetchFavicon(parsedUrl);
      let title = `GitHub: ${repoPath}`;

      // Add file path to title if present
      if (filePath) {
        title += ` - ${filePath}`;
      }

      return [
        {
          icon,
          description: url,
          content: markdownContent,
          name: title,
          uri: {
            type: "url",
            value: url,
          },
          // Add metadata for file path if present
          ...(filePath && {
            metadata: {
              filePath,
              repository: repoPath,
            },
          }),
        },
      ];
    } catch (e) {
      console.error("Error handling GitHub repository:", e);
      return [];
    }
  }
}

export default URLContextProvider;
