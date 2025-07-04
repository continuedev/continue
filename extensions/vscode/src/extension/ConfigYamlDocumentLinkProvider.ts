import * as path from "path";

import * as vscode from "vscode";

export class ConfigYamlDocumentLinkProvider
  implements vscode.DocumentLinkProvider
{
  private usesPattern = /^\s*#?\s*-\s*uses:\s*(.+)$/;
  provideDocumentLinks(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.DocumentLink[]> {
    const links: vscode.DocumentLink[] = [];

    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
      if (token.isCancellationRequested) {
        return [];
      }
      const line = document.lineAt(lineIndex);
      const match = this.usesPattern.exec(line.text);

      if (match) {
        let slug = match[1].trim();
        // Remove any leading comment symbols (#)
        slug = slug.replace(/^\s*(#\s*)+/, "");

        // Check for surrounding quotes
        const quoteMatch = slug.match(/^(['"])(.*)\1/);
        if (quoteMatch) {
          // If quoted, remove the quotes but keep everything inside (including #)
          slug = quoteMatch[2].trim();
        } else {
          // If not quoted, remove any trailing comment
          slug = slug.replace(/\s*#.*$/, "").trim();
        }

        if (slug === "") {
          continue; // Skip empty slugs
        }

        if (/^(https?:\/\/|file:\/\/)/.test(slug)) {
          // VS Code already handles external links, so skip them
          continue;
        }
        const startPos = line.text.indexOf(slug);
        const range = new vscode.Range(
          lineIndex,
          startPos,
          lineIndex,
          startPos + slug.length,
        );

        let linkUri: vscode.Uri;
        if (slug.startsWith("./") || slug.startsWith("../")) {
          const currentFilePath = document.uri.fsPath;
          const parentPath = path.dirname(currentFilePath);
          const resolvedPath = path.resolve(parentPath, slug);
          linkUri = vscode.Uri.file(resolvedPath);
        } else {
          linkUri = vscode.Uri.parse(`https://hub.continue.dev/${slug}`);
        }

        const link = new vscode.DocumentLink(range, linkUri);
        links.push(link);
      }
    }

    return links;
  }
  resolveDocumentLink(
    link: vscode.DocumentLink,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.DocumentLink> {
    return link;
  }
}
