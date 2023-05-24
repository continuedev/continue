import pythonLanguageLibrary from "./python";
import javascriptLanguageLibrary from "./javascript";
import { LanguageLibrary } from "./index.d";

export const languageLibraries: LanguageLibrary[] = [
  pythonLanguageLibrary,
  javascriptLanguageLibrary,
];

export function getLanguageLibrary(filepath: string): LanguageLibrary {
  for (let languageLibrary of languageLibraries) {
    for (let fileExtension of languageLibrary.fileExtensions) {
      if (filepath.endsWith(fileExtension)) {
        return languageLibrary;
      }
    }
  }
  throw new Error(`No language library found for file ${filepath}`);
}
