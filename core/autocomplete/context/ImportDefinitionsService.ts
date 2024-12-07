import { IDE, RangeInFileWithContents } from "../..";
import { PrecalculatedLruCache } from "../../util/LruCache";
import {
  getFullLanguageName,
  getParserForFile,
  getQueryForFile,
} from "../../util/treeSitter";
import { createOutline } from "./outline/createOutline";

interface FileInfo {
  imports: { [key: string]: RangeInFileWithContents[] };
}

export class ImportDefinitionsService {
  static N = 10;

  private cache: PrecalculatedLruCache<FileInfo> =
    new PrecalculatedLruCache<FileInfo>(
      this._getFileInfo.bind(this),
      ImportDefinitionsService.N,
    );

  constructor(private readonly ide: IDE) {
    ide.onDidChangeActiveTextEditor((filepath) => {
      this.cache.initKey(filepath);
    });
  }

  get(filepath: string): FileInfo | undefined {
    return this.cache.get(filepath);
  }

  private async _getFileInfo(filepath: string): Promise<FileInfo> {
    const parser = await getParserForFile(filepath);
    if (!parser) {
      return {
        imports: {},
      };
    }
    const ast = parser.parse(await this.ide.readFile(filepath), undefined, {
      includedRanges: [
        {
          startIndex: 0,
          endIndex: 10_000,
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 100, column: 0 },
        },
      ],
    });
    const language = getFullLanguageName(filepath);
    const query = await getQueryForFile(
      filepath,
      `import-queries/${language}.scm`,
    );
    if (!query) {
      return {
        imports: {},
      };
    }

    const matches = query?.matches(ast.rootNode);

    const fileInfo: FileInfo = {
      imports: {},
    };
    for (const match of matches) {
      const startPosition = match.captures[0].node.startPosition;
      const defs = await this.ide.gotoDefinition({
        filepath,
        position: {
          line: startPosition.row,
          character: startPosition.column,
        },
      });
      fileInfo.imports[match.captures[0].node.text] = await Promise.all(
        defs.map(async (def) => {
          const outline = await createOutline(
            def.filepath,
            await this.ide.readFile(def.filepath),
            def.range,
          );
          return {
            ...def,
            contents:
              outline ??
              (await this.ide.readRangeInFile(def.filepath, def.range)),
          };
        }),
      );
    }

    return fileInfo;
  }
}
