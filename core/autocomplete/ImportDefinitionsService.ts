import { IDE } from "../index.js";
import { RangeInFileWithContents } from "../commands/util.js";
import { PrecalculatedLruCache } from "../util/LruCache.js";
import {
  TSQueryType,
  getParserForFile,
  getQueryForFile,
} from "../util/treeSitter.js";

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
    const query = await getQueryForFile(filepath, TSQueryType.Imports);
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
        defs.map(async (def) => ({
          ...def,
          contents: await this.ide.readRangeInFile(def.filepath, def.range),
        })),
      );
    }

    return fileInfo;
  }
}
