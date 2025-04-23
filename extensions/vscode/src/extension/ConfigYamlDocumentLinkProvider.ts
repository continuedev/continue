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
      const line = document.lineAt(lineIndex);
      const match = this.usesPattern.exec(line.text);

      if (match) {
        const slug = match[1].trim();
        const startPos = line.text.indexOf(slug);
        const range = new vscode.Range(
          lineIndex,
          startPos,
          lineIndex,
          startPos + slug.length,
        );

        const link = new vscode.DocumentLink(
          range,
          vscode.Uri.parse(`https://hub.continue.dev/${slug}`),
        );
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
