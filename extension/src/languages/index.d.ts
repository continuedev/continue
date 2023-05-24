export interface LanguageLibrary {
  language: string;
  fileExtensions: string[];
  parseFirstStacktrace: (stdout: string) => string | undefined;
  lineIsFunctionDef: (line: string) => boolean;
  parseFunctionDefForName: (line: string) => string;
  lineIsComment: (line: string) => boolean;
  writeImport: (
    sourcePath: string,
    pathToImport: string,
    namesToImport?: string[] | undefined
  ) => string;
}
