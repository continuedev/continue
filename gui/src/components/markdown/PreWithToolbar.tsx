import { useState } from "react";
import CodeBlockToolBar from "./CodeBlockToolbar";

function PreWithToolbar(props: { copyvalue: string; children: any }) {
  const [hovering, setHovering] = useState(false);

  return (
    <pre
      {...props}
      style={{ padding: "0px" }}
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {hovering && <CodeBlockToolBar text={props.copyvalue}></CodeBlockToolBar>}
      {props.children}
    </pre>
  );
}

export default PreWithToolbar;
