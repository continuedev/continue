import * as fs from "node:fs";
import * as path from "node:path";
import { Registry } from "./interfaces/index.js";
import { FullSlug, PackageIdentifier } from "./interfaces/slugs.js";

interface RegistryClientOptions {
  accessToken?: string;
  apiBase?: string;
  rootPath?: string;
}

export class RegistryClient implements Registry {
  private readonly accessToken?: string;
  private readonly apiBase: string;
  private readonly rootPath?: string;

  constructor(options: RegistryClientOptions = {}) {
    this.accessToken = options.accessToken;
    this.apiBase = options.apiBase ?? "https://api.continue.dev/";
    this.rootPath = options.rootPath;
    if (!this.apiBase.endsWith("/")) {
      this.apiBase += "/";
    }
  }

  async getContent(id: PackageIdentifier): Promise<string> {
    // Return pre-read content if available (for vscode-remote:// URIs in WSL)
    if (id.uriType === "file" && id.content !== undefined) {
      console.debug(
        `RegistryClient: Using pre-read content for file: ${id.fileUri}`,
      );
      return id.content;
    }

    switch (id.uriType) {
      case "file":
        console.debug(
          `RegistryClient: Getting content from file: ${id.fileUri}`,
        );
        return this.getContentFromFilePath(id.fileUri);
      case "slug":
        console.debug(
          `RegistryClient: Getting content from slug: ${id.fullSlug.ownerSlug}/${id.fullSlug.packageSlug}`,
        );
        return this.getContentFromSlug(id.fullSlug);
      default:
        throw new Error(
          `Unknown package identifier type: ${(id as any).uriType}`,
        );
    }
  }

  private getContentFromFilePath(filepath: string): string {
    try {
      if (filepath.startsWith("file://")) {
        // For Windows file:///C:/path/to/file, we need to handle it properly
        // On other systems, we might have file:///path/to/file
        console.debug(`RegistryClient: Reading file from URL: ${filepath}`);
        const content = fs.readFileSync(new URL(filepath), "utf8");
        console.debug(
          `RegistryClient: Successfully read ${content.length} bytes from URL`,
        );
        return content;
      } else if (path.isAbsolute(filepath)) {
        console.debug(`RegistryClient: Reading absolute path: ${filepath}`);
        const content = fs.readFileSync(filepath, "utf8");
        console.debug(
          `RegistryClient: Successfully read ${content.length} bytes from absolute path`,
        );
        return content;
      } else {
        // Try to resolve relative to current working directory first
        const resolvedPath = path.resolve(filepath);
        if (fs.existsSync(resolvedPath)) {
          console.debug(
            `RegistryClient: Reading path relative to CWD: ${resolvedPath}`,
          );
          const content = fs.readFileSync(resolvedPath, "utf8");
          console.debug(
            `RegistryClient: Successfully read ${content.length} bytes from CWD-relative path`,
          );
          return content;
        }
        // Fall back to rootPath if file doesn't exist relative to cwd
        if (this.rootPath) {
          const joinedPath = path.join(this.rootPath, filepath);
          console.debug(
            `RegistryClient: Reading path relative to rootPath (${this.rootPath}): ${joinedPath}`,
          );
          const content = fs.readFileSync(joinedPath, "utf8");
          console.debug(
            `RegistryClient: Successfully read ${content.length} bytes from rootPath-relative path`,
          );
          return content;
        }
        throw new Error("No rootPath provided for relative file path");
      }
    } catch (error) {
      console.error(
        `RegistryClient: Error reading file at ${filepath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private async getContentFromSlug(fullSlug: FullSlug): Promise<string> {
    const url = `${this.apiBase}registry/v1/${fullSlug.ownerSlug}/${fullSlug.packageSlug}/${fullSlug.versionSlug}`;
    console.debug(`RegistryClient: Fetching content from slug URL: ${url}`);
    const response = await fetch(url, {
      headers: {
        ...(this.accessToken
          ? { Authorization: `Bearer ${this.accessToken}` }
          : {}),
      },
    });
    const data = await response.json();
    console.debug(
      `RegistryClient: Successfully fetched ${data.content?.length || 0} bytes from slug`,
    );
    return data.content;
  }
}
