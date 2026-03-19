import * as fs from "node:fs";
import * as path from "node:path";
import { Registry } from "./interfaces/index.js";
import { PackageIdentifier } from "./interfaces/slugs.js";

interface RegistryClientOptions {
  rootPath?: string;
}

export class RegistryClient implements Registry {
  private readonly rootPath?: string;

  constructor(options: RegistryClientOptions = {}) {
    this.rootPath = options.rootPath;
  }

  async getContent(id: PackageIdentifier): Promise<string> {
    // Return pre-read content if available (for vscode-remote:// URIs in WSL)
    if (id.uriType === "file" && id.content !== undefined) {
      return id.content;
    }

    switch (id.uriType) {
      case "file":
        return this.getContentFromFilePath(id.fileUri);
      case "slug":
        throw new Error("Slug-based package resolution is not supported");
      default:
        throw new Error(
          `Unknown package identifier type: ${(id as any).uriType}`,
        );
    }
  }

  private getContentFromFilePath(filepath: string): string {
    if (filepath.startsWith("file://")) {
      // For Windows file:///C:/path/to/file, we need to handle it properly
      // On other systems, we might have file:///path/to/file
      return fs.readFileSync(new URL(filepath), "utf8");
    } else if (path.isAbsolute(filepath)) {
      return fs.readFileSync(filepath, "utf8");
    } else if (this.rootPath) {
      return fs.readFileSync(path.join(this.rootPath, filepath), "utf8");
    } else {
      throw new Error("No rootPath provided for relative file path");
    }
  }
}
