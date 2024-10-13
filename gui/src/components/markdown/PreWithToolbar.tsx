import { debounce } from "lodash";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import styled from "styled-components";
import { defaultBorderRadius, vscEditorBackground } from "..";
import useUIConfig from "../../hooks/useUIConfig";
import { RootState } from "../../redux/store";
import CodeBlockToolBar from "./CodeBlockToolbar";

const TopDiv = styled.div`
  outline: 0.5px solid rgba(153, 153, 152);
  outline-offset: -0.5px;
  border-radius: ${defaultBorderRadius};
  margin-bottom: 8px;
  background-color: ${vscEditorBackground};
`;

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

function PreWithToolbar(props: {
  children: any;
  language: string | null;
  codeBlockIndex: number;
  filepath?: string | undefined;
}) {
  const uiConfig = useUIConfig();
  const toolbarBottom = uiConfig?.codeBlockToolbarPosition == "bottom";

  const [hovering, setHovering] = useState(false);
  const [copyValue, setCopyValue] = useState("");

  const nextCodeBlockIndex = useSelector(
    (state: RootState) => state.uiState.nextCodeBlockToApplyIndex,
  );

  useEffect(() => {
    if (copyValue === "") {
      setCopyValue(childrenToText(props.children.props.children));
    } else {
      const debouncedEffect = debounce(() => {
        setCopyValue(childrenToText(props.children.props.children));
      }, 100);

      debouncedEffect();

      return () => {
        debouncedEffect.cancel();
      };
    }
  }, [props.children, copyValue]);

  return (
    <TopDiv
      tabIndex={-1}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {!!props.filepath ? (
        <CodeBlockToolBar
          isNextCodeBlock={nextCodeBlockIndex === props.codeBlockIndex}
          text={copyValue}
          bottom={toolbarBottom}
          language={props.language}
          filepath={props.filepath}
        />
      ) : (
        hovering && (
          <CodeBlockToolBar
            isNextCodeBlock={nextCodeBlockIndex === props.codeBlockIndex}
            text={copyValue}
            bottom={toolbarBottom}
            language={props.language}
          />
        )
      )}

      {props.children}
    </TopDiv>
  );
}

export default PreWithToolbar;
