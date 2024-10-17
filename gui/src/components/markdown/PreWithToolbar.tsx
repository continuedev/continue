import { debounce } from "lodash";
import { useEffect, useMemo, useState } from "react";
import useUIConfig from "../../hooks/useUIConfig";
import CodeBlockToolBar from "./CodeBlockToolbar";
import FileCreateChip from "./FileCreateChip";
import { useSelector } from "react-redux";
import { defaultModelSelector } from "../../redux/selectors/modelSelectors";

function childToText(child: any): string {
  if (typeof child === "string") {
    return child;
  }

  if (Array.isArray(child)) {
    return child.map(childToText).join("");
  }

  if (child?.props?.children) {
    return childToText(child.props.children);
  }

  return "";
}

function childrenToText(children: any): string {
  return Array.isArray(children)
    ? children.map(childToText).join("")
    : childToText(children);
}

function PreWithToolbar(props: {
  children: any;
  language: string | undefined;
}) {
  const uiConfig = useUIConfig();
  const toolbarBottom = uiConfig?.codeBlockToolbarPosition == "bottom";

  const [hovering, setHovering] = useState(false);

  const [rawCodeBlock, setRawCodeBlock] = useState("");
  const [isCreateFile, setIsCreateFile] = useState(false);
  const [checkedForCreateFile, setCheckedForCreateFile] = useState(false);

  const defaultModel = useSelector(defaultModelSelector);
  const isBareChatMode = useMemo(() => defaultModel?.title?.toLowerCase() === "aider", [defaultModel]);

  useEffect(() => {
    const debouncedEffect = debounce(() => {
      setRawCodeBlock(childrenToText(props.children.props.children));
    }, 50);

    debouncedEffect();

    return () => {
      debouncedEffect.cancel();
    };
  }, [props.children]);

  useEffect(() => {
    if (isCreateFile || checkedForCreateFile) return;

    const lines = childrenToText(props.children.props.children)
      .trim()
      .split("\n");
    // file creation code block will only have 1 line
    if (lines.length > 2) {
      setCheckedForCreateFile(true);
    }

    if (lines[0].startsWith("pearCreateFile:")) {
      setIsCreateFile(true);
    } else {
      setIsCreateFile(false);
    }
  }, [props.children]);

  return isCreateFile ? (
    <FileCreateChip rawCodeBlock={rawCodeBlock}></FileCreateChip>
  ) : (
    <div
      style={{ padding: "0px" }}
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {!toolbarBottom && hovering && !isBareChatMode && (
        <CodeBlockToolBar
          text={rawCodeBlock}
          bottom={toolbarBottom}
          language={props.language}
        ></CodeBlockToolBar>
      )}
      {props.children}
      {toolbarBottom && hovering && (
        <CodeBlockToolBar
          text={rawCodeBlock}
          bottom={toolbarBottom}
          language={props.language}
        ></CodeBlockToolBar>
      )}
    </div>
  );
}

export default PreWithToolbar;
