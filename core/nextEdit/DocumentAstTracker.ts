// TODO:
// Create a DocumentAstTracker singleton class that keeps track of a map of document paths to their history of ASTs.
// There should be a map from document path to history of ASTs (a LIFO stack of ASTs where the newest AST is at the front)
// We want to expose these methods:
// add document and its first AST
// push to an existing document's AST history stack
// get the most recent AST of an existing document's AST
// The AST and nodes will be using web-tree-sitter types.
// save map to file as a documentAstTracker.json inside the user's global continue path
// delete document from map
// clear map
import * as fs from "fs";
import * as path from "path";
import Parser from "web-tree-sitter";
import { getContinueGlobalPath } from "../util/paths";

/**
 * Singleton class that keeps track of a map of document paths to their history of ASTs.
 */
export class DocumentAstTracker {
  private static instance: DocumentAstTracker | null = null;

  // Map from document path to history of ASTs (LIFO stack where newest AST is at the front).
  private documentAstMap: Map<string, Parser.Tree[]>;
  private documentContentHistoryMap: Map<string, string[]>;

  // Path to save the AST tracker data.
  private readonly savePath: string;

  private constructor() {
    this.documentAstMap = new Map<string, Parser.Tree[]>();
    this.documentContentHistoryMap = new Map<string, string[]>();
    this.savePath = path.join(
      getContinueGlobalPath(),
      "documentAstTracker.jsonl",
    );

    // Try to load existing data.
    // this.loadFromFile();
  }

  /**
   * Get the singleton instance of DocumentAstTracker.
   */
  public static getInstance(): DocumentAstTracker {
    if (!DocumentAstTracker.instance) {
      DocumentAstTracker.instance = new DocumentAstTracker();
    }

    return DocumentAstTracker.instance;
  }

  /**
   * Add a document and its first AST to the tracker.
   *
   * @param documentPath The path of the document.
   * @param ast The first AST of the document.
   */
  public addDocument(
    documentPath: string,
    documentContent: string,
    ast: Parser.Tree,
  ): void {
    this.documentAstMap.set(documentPath, [ast]);
    this.documentContentHistoryMap.set(documentPath, [documentContent]);
    // this.saveToFile();
  }

  /**
   * Push a new AST to an existing document's history stack.
   *
   * @param documentPath The path of the document.
   * @param ast The new AST to push to the document's history stack.
   * @throws Error if the document doesn't exist in the tracker.
   */
  public pushAst(
    documentPath: string,
    documentContent: string,
    ast: Parser.Tree,
  ): void {
    const astHistory = this.documentAstMap.get(documentPath);
    const documentHistory = this.documentContentHistoryMap.get(documentPath);

    if (!astHistory || !documentHistory) {
      console.error(`Document ${documentPath} not found in AST tracker`);
      this.addDocument(documentPath, documentContent, ast);
    }

    console.log("same AST:", this.getMostRecentAst(documentPath) !== ast);

    // Add the new AST to the front of the array (LIFO stack).
    astHistory!.unshift(ast);
    documentHistory!.unshift(documentContent);
    // this.saveToFile();
  }

  /**
   * Get the most recent AST of a document.
   *
   * @param documentPath The path of the document.
   * @returns The most recent AST of the document.
   * @throws Error if the document doesn't exist in the tracker.
   */
  public getMostRecentAst(documentPath: string): Parser.Tree | null {
    const astHistory = this.documentAstMap.get(documentPath);

    if (!astHistory) {
      console.error(`Document ${documentPath} not found in AST tracker`);
      return null;
    }
    if (astHistory.length === 0) {
      console.error(`Document ${documentPath} has no ASTs`);
      return null;
    }

    // Return the first element (most recent AST).
    return astHistory[0];
  }

  /**
   * Get the most recent AST of a document.
   *
   * @param documentPath The path of the document.
   * @returns The most recent document history of the document.
   * @throws Error if the document doesn't exist in the tracker.
   */
  public getMostRecentDocumentHistory(documentPath: string): string | null {
    const documentHistory = this.documentContentHistoryMap.get(documentPath);

    if (!documentHistory) {
      console.error(`Document ${documentPath} not found in AST tracker`);
      return null;
    }
    if (documentHistory.length === 0) {
      console.error(`Document ${documentPath} has no history`);
      return null;
    }

    // Return the first element (most recent doc history).
    return documentHistory[0];
  }

  /**
   * Delete a document from the tracker.
   *
   * @param documentPath The path of the document to delete.
   */
  public deleteDocument(documentPath: string): void {
    this.documentAstMap.delete(documentPath);
    this.documentContentHistoryMap.delete(documentPath);
    // this.saveToFile();
  }

  /**
   * Clear all documents from the tracker.
   */
  public clearMap(): void {
    this.documentAstMap.clear();
    this.documentContentHistoryMap.clear();
    // this.saveToFile();
  }

  /**
   * Save the current state of the tracker to a file.
   */
  private saveToFile(): void {
    try {
      // We can't directly serialize Tree objects to JSON.
      // So we'll just save the paths - this serves as a record of which documents we're tracking.
      // The actual ASTs will need to be recreated when needed.
      const documentPaths = Array.from(this.documentAstMap.keys());
      const serializableData = { documentPaths };

      fs.writeFileSync(
        this.savePath,
        JSON.stringify(serializableData, null, 2),
      );
    } catch (error) {
      console.error("Error saving AST tracker data to file:", error);
    }
  }

  /**
   * Load the tracker state from a file.
   */
  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.savePath)) {
        const fileContent = fs.readFileSync(this.savePath, "utf-8");
        const data = JSON.parse(fileContent);

        // We only saved the paths, not the actual Trees.
        // The Trees need to be reparsed when the documents are loaded again.
        if (data && data.documentPaths) {
          // Initialize empty arrays for each document.
          data.documentPaths.forEach((path: string) => {
            this.documentAstMap.set(path, []);
          });
        }
      }
    } catch (error) {
      console.error("Error loading AST tracker data from file:", error);
      // If loading fails, we'll start with an empty map.
      this.documentAstMap = new Map<string, Parser.Tree[]>();
    }
  }
}
