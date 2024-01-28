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

  function childrenToText(children: any) {
    return children.map((child: any) => childToText(child)).join("");
  }

  return (
    <pre
      {...props}
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
