import { wireTmGrammars } from "monaco-editor-textmate";
import { Registry } from "monaco-textmate";
import { useMemo, useRef, useState } from "react";
import MonacoEditor from "react-monaco-editor";
import styled from "styled-components";
import {
  VSC_EDITOR_BACKGROUND_VAR,
  defaultBorderRadius,
  parseColorForHex,
} from "..";

const fetchTextMateGrammar = async (lang: string): Promise<string> => {
  return (
    await fetch(
      `${(window as any).vscMediaUrl}/textmate-syntaxes/${lang}.tmLanguage.json`
    )
  ).text();
};

const supportedLanguages = {
  "source.ts": ["typescript", "TypeScript"],
  "source.js": ["javascript", "JavaScript"],
};

const registry = new Registry({
  getGrammarDefinition: async (scopeName) => {
    if (scopeName in supportedLanguages) {
      const [_, tmFilename] = supportedLanguages[scopeName];
      return {
        format: "json",
        content: await fetchTextMateGrammar(tmFilename),
      };
    } else {
      return null;
    }
  },
});

const theme = {
  id: "custom-theme",
  name: "Custom Theme",
  theme: {
    ...(window as any).fullColorTheme,
    base: "vs-dark",
    inherit: true,
    encodedTokensColors: undefined,
    // rules: [],
    colors: {
      "editor.background": parseColorForHex(VSC_EDITOR_BACKGROUND_VAR),
    },
  },
};

const ContainerDiv = styled.div`
  border-radius: ${defaultBorderRadius};
  overflow: hidden;
  border: 1px solid #8888;
`;

interface MonacoCodeBlockProps {
  codeString: string;
  preProps: any;
}

export const ThemedMonacoTest = (props: MonacoCodeBlockProps) => {
  const monacoRef = useRef(null);
  const editorRef = useRef();

  // code in editor
  const [value, setValue] = useState(props.codeString);

  const setCurrentTheme = (themeId) => {
    monacoRef.current.editor.defineTheme("custom-theme", theme.theme);

    liftOff(monacoRef.current).then(() =>
      monacoRef.current.editor.setTheme("custom-theme")
    );
  };

  const liftOff = async (monaco) => {
    const grammars = new Map();

    for (const [scopeName, [languageId, _]] of Object.entries(
      supportedLanguages
    )) {
      grammars.set(languageId, scopeName);
      monaco.languages.register({ id: languageId });
    }

    await wireTmGrammars(monaco, registry, grammars, editorRef.current);
  };

  const onEditorDidMount = (editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;

    setCurrentTheme(theme);
  };

  const onEditorChange = (value) => {
    setValue(value);
  };

  const memoizedEditor = useMemo(
    () => (
      <MonacoEditor
        height={props.codeString.split("\n").length * 19}
        value={props.codeString}
        editorDidMount={onEditorDidMount}
        onChange={onEditorChange}
        language="typescript"
        options={{
          readOnly: true,
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
          guides: {
            indentation: false,
          },
          renderLineHighlight: "none",
        }}
      />
    ),
    [onEditorChange, onEditorDidMount]
  );

  return <ContainerDiv {...props.preProps}>{memoizedEditor}</ContainerDiv>;
};
