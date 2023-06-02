import React from "react";
import { postVscMessage } from "../vscode";

function VS CodeFileLink(props: { path: string; text?: string }) {
  return (
    <a
      href={`file://${props.path}`}
      onClick={() => {
        postVscMessage("openFile", { path: props.path });
      }}
    >
      {props.text || props.path}
    </a>
  );
}

export default VS CodeFileLink;
