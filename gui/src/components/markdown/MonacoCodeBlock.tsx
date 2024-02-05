import MonacoEditor, { OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius } from "..";

const ContainerDiv = styled.div`
  border-radius: ${defaultBorderRadius};
  overflow: hidden;
  border: 1px solid #8888;
`;

interface MonacoCodeBlockProps {
  codeString: string;
  preProps: any;
}

const MonacoCodeBlock = (props: MonacoCodeBlockProps) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // const aTheme = {
    //   base: "vs-dark" as const,
    //   inherit: true,
    //   rules: [
    //     {
    //       token: "identifier",
    //       foreground: "9CDCFE",
    //     },
    //     {
    //       token: "punctuation.definition.comment",
    //       foreground: "DCDCAA",
    //     },
    //     {
    //       token: "type",
    //       foreground: "1AAFB0",
    //     },
    //   ],
    //   colors: {},
    // };
    // const bTheme = {
    //   ...(window as any).fullColorTheme,
    //   base: "vs-dark",
    //   inherit: true,
    //   encodedTokensColors: undefined,
    //   // rules: [],
    //   colors: {},
    // };
    // monaco.editor.defineTheme("custom-theme", bTheme);
    // monaco.editor.setTheme("custom-theme");
  };

  const [currentText, setCurrentText] = useState(props.codeString);

  const appendText = (text: string) => {
    if (editorRef.current && text !== currentText) {
      const editor = editorRef.current;
      const model = editor.getModel();
      if (model) {
        const lastLine = model.getLineCount();
        const lastColumn = model.getLineMaxColumn(lastLine);

        const toAppend = text.slice(currentText.length);
        console.log("appending text: ", lastLine, lastColumn, toAppend);

        const id = { major: 1, minor: 1 };
        const op = {
          identifier: id,
          range: {
            startLineNumber: lastLine,
            startColumn: lastColumn,
            endLineNumber: lastLine,
            endColumn: lastColumn + 1,
          },
          text: toAppend,
          forceMoveMarkers: true,
        };
        editor.executeEdits("my-source", [op]);

        setCurrentText(text);

        // const editorElement = editor.getDomNode();
        // editorElement.style.height = `${text.split("\n").length * 19}px`;
        // editor.layout();
      }
    }
  };

  useEffect(() => {
    appendText(props.codeString);
  }, [props.codeString, currentText]);

  const memoizedEditor = useMemo(
    () => (
      <MonacoEditor
        height={180}
        // height={props.codeString.split("\n").length * 18 + 18}
        defaultLanguage="python"
        defaultValue={props.codeString}
        theme="vs-dark"
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
        onMount={handleEditorMount}
      />
    ),
    [handleEditorMount]
  );

  return <ContainerDiv {...props.preProps}>{memoizedEditor}</ContainerDiv>;
};

export default MonacoCodeBlock;
