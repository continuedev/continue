import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { DiffEditor } from "@monaco-editor/react";
import React, { useEffect } from "react";
import { v4 } from "uuid";
import { vscInputBackground } from "../components";
import HeaderButtonWithText from "../components/HeaderButtonWithText";
import { postToIde } from "../util/ide";

interface EditorFrameProps {
  filename: string;
}

function EditorFrame(props: EditorFrameProps) {
  const [contents, setContents] = React.useState(
    "function sum(a, b) {return a + b;}"
  );

  useEffect(() => {
    const messageId = v4();
    const eventListener = (event: any) => {
      if (
        event.data.messageId === messageId &&
        event.data.type === "readRangeInFile"
      ) {
        setContents(event.data.contents);
      }
    };
    window.addEventListener("message", eventListener);

    postToIde("readFile", { filepath: props.filename });

    return () => window.removeEventListener("message", eventListener);
  }, []);

  return (
    <div>
      <div
        className="my-2 px-2 py-1 flex justify-between items-center"
        style={{
          backgroundColor: vscInputBackground,
        }}
      >
        <code
          className="cursor-pointer"
          onClick={() => {
            postToIde("showFile", {
              filepath: props.filename,
            });
          }}
        >
          {props.filename.split("/").pop()}
        </code>
        <div className="flex items-center">
          <HeaderButtonWithText text="Reject" onClick={() => {}}>
            <XMarkIcon width="1.3em" height="1.3em" color="red" />
          </HeaderButtonWithText>
          <HeaderButtonWithText text="Accept" onClick={() => {}}>
            <CheckIcon width="1.3em" height="1.3em" color="lightgreen" />
          </HeaderButtonWithText>
        </div>
      </div>
      {/* <Editor
        className="border-gray-600 border border-solid rounded-md overflow-visible p-1 max-w-3xl"
        height="90px"
        width="90vw"
        defaultLanguage="typescript"
        defaultValue={contents}
        options={{ theme: "vs-dark", minimap: { enabled: false } }}
      /> */}
      <DiffEditor
        theme="vs-dark"
        className="overflow-visible p-1"
        height="90px"
        options={{
          minimap: { enabled: false },
          readOnly: false,
          scrollbar: {
            vertical: "hidden",
          },
        }}
        original={contents}
        modified="function sum(a, b) {return d + c;}"
      />
    </div>
  );
}

const FILENAMES = [
  "/Users/natesesti/Desktop/continue/gui/src/hooks/CustomPostHogProvider.tsx",
  "/Users/natesesti/Desktop/continue/gui/src/hooks/CustomPostHogProvider.tsx",
  "/Users/natesesti/Desktop/continue/gui/src/hooks/CustomPostHogProvider.tsx",
];

function MonacoPage() {
  return (
    <div>
      <h1 className="px-4">Multi-File Edit</h1>
      {FILENAMES.map((filename) => {
        return <EditorFrame filename={filename} />;
      })}
    </div>
  );
}

export default MonacoPage;
