// import { convertTheme } from 'monaco-vscode-textmate-theme-converter/lib/cjs';
import { Registry } from "monaco-textmate";
// import { wireTmGrammars } from 'monaco-editor-textmate';

const registry = new Registry({
  getGrammarDefinition: async (scopeName) => {
    if (scopeName == "source.ts") {
      return {
        format: "json",
        content: await (await fetch("./TypeScript.tmLanguage.json")).text(),
      };
    } else if (scopeName == "source.js") {
      return {
        format: "json",
        content: await (await fetch("./JavaScript.tmLanguage.json")).text(),
      };
    } else {
      return null;
    }
  },
});

export function useMonacoTheme() {}
