import React from "react";
import { postToIde } from "../vscode";

function VSCodeFileLink(props: { path: string; text?: string }) {
  return (
    <a
      href={`file://${props.path}`}
      onClick={() => {
        postToIde("openFile", { path: props.path });
      }}
    >
      {props.text || props.path}
    </a>
  );
}

export default VSCodeFileLink;
