import { IDE, Location } from "../..";
import { LANGUAGES } from "../constants/AutocompleteLanguageInfo";

import { getSymbolsForSnippet } from "./ranking";

interface FileInfo {
  filepath: string;
}

export class NearbyDefinitionsService {
  static N = 10;

  constructor(private readonly ide: IDE) {}

  async getDefinitionsForLine(filepath: string, line: number) {
    const lineContent = await this.ide.readRangeInFile(filepath, {
      start: {
        line,
        character: 0,
      },
      end: {
        line: line + 1,
        character: 0,
      },
    });

    // Remove keywords
    const lang = LANGUAGES[filepath.split(".").slice(-1)[0]];
    const symbols = Array.from(getSymbolsForSnippet(lineContent))
      .filter((s) => s.length > 0)
      .filter((s) => !(lang && lang?.stopWords?.includes(s)));

    return Promise.all(
      symbols.map((s) => {
        const character = lineContent.indexOf(s);
        const pos: Location = {
          filepath,
          position: {
            line,
            character,
          },
        };
      }),
    );
  }
}
