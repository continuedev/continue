import { useRef, useState } from "react";
// import Editor from '@monaco-editor/react';
import { wireTmGrammars } from "monaco-editor-textmate";
import { Registry } from "monaco-textmate";
import MonacoEditor from "react-monaco-editor";

const Themes = {
  DARK_PLUS: {
    value: "dark+",
    display: "Dark+ (default dark)",
  },
  CSB_DEFAULT: {
    value: "csb-default",
    display: "CSB (Default)",
  },
};

const fetchTextMateGrammar = async (lang: string): Promise<string> => {
  return (
    await fetch(
      `${(window as any).vscMediaUrl}/textmate-syntaxes/${lang}.tmLanguage.json`
    )
  ).text();
};

const registry = new Registry({
  getGrammarDefinition: async (scopeName) => {
    if (scopeName == "source.ts") {
      return {
        format: "json",
        content: await fetchTextMateGrammar("TypeScript"),
      };
    } else if (scopeName == "source.js") {
      return {
        format: "json",
        content: await fetchTextMateGrammar("JavaScript"),
      };
    } else {
      return null;
    }
  },
});

const fullColorTheme = (window as any).fullColorTheme;
const aTheme = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    {
      token: "identifier",
      foreground: "9CDCFE",
    },
    {
      token: "punctuation.definition.comment",
      foreground: "DCDCAA",
    },
    {
      token: "type",
      foreground: "1AAFB0",
    },
  ],
  colors: {},
};
const bTheme = {
  ...(window as any).fullColorTheme,
  base: "vs-dark",
  inherit: true,
  encodedTokensColors: undefined,
  // rules: [],
  colors: {},
};
console.log("FUL: ", fullColorTheme);
const theme = {
  id: Themes.DARK_PLUS.value,
  name: Themes.DARK_PLUS.display,
  // theme: { ...darkPlusTheme, inherit: true },
  theme: bTheme,
};

interface MonacoCodeBlockProps {
  codeString: string;
  preProps: any;
}

export const ThemedMonacoTest = (props: MonacoCodeBlockProps) => {
  const monacoRef = useRef(null);
  const editorRef = useRef();

  // code in editor
  const [value, setValue] = useState("const sum = (a, b) => a + b");

  const setCurrentTheme = (themeId) => {
    monacoRef.current.editor.defineTheme("custom-theme", theme.theme);

    liftOff(monacoRef.current).then(() =>
      monacoRef.current.editor.setTheme("custom-theme")
    );
  };

  const liftOff = async (monaco) => {
    // map of monaco "language id's" to TextMate scopeNames
    const grammars = new Map();

    // grammars.set('css', 'source.css');
    // grammars.set('html', 'text.html.basic');
    // grammars.set('typescript', 'source.ts');

    grammars.set("typescript", "source.ts");
    grammars.set("javascript", "source.js");

    monaco.languages.register({ id: "typescript" });
    monaco.languages.register({ id: "javascript" });

    await wireTmGrammars(monaco, registry, grammars, editorRef.current);
    console.log("WIRED");
  };

  const onEditorDidMount = (editor, monaco) => {
    // console.log('editor did mount');
    monacoRef.current = monaco;
    editorRef.current = editor;

    setCurrentTheme(theme);
  };

  const onEditorChange = (value, event) => {
    setValue(value);
  };

  return (
    <div id="monaco-container">
      <MonacoEditor
        value={props.codeString}
        editorDidMount={onEditorDidMount}
        onChange={onEditorChange}
        language="typescript"
        height={200}
        options={{
          readOnly: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          scrollbar: {
            alwaysConsumeMouseWheel: false,
            verticalScrollbarSize: 4,
            horizontalScrollbarSize: 4,
          },
          hover: {},
          renderWhitespace: "none",
          overviewRulerLanes: 0,
          lineNumbers: "off",
          folding: false,
        }}
      />
    </div>
  );
};
