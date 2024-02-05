import { useState } from "react";
import CodeBlockToolBar from "./CodeBlockToolbar";

function PreWithToolbar(props: any) {
  const [hovering, setHovering] = useState(false);

  function childToText(child: any) {
    if (typeof child === "string") {
      return child;
    } else if (child?.props) {
      return childToText(child.props?.children);
    } else if (Array.isArray(child)) {
      return childrenToText(child);
    } else {
      return "";
    }
  }

  function childrenToText(child: any) {
    return child.props.codeString || "";
  }

  return (
    <pre
      {...props}
      style={{ padding: "0px" }}
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {hovering && (
        <CodeBlockToolBar
          text={childrenToText(props.children)}
        ></CodeBlockToolBar>
      )}
      {props.children}
    </pre>
  );
}

export default PreWithToolbar;
