import { debounce } from "lodash";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import styled from "styled-components";
import { defaultBorderRadius, lightGray } from "..";
import useUIConfig from "../../hooks/useUIConfig";
import { RootState } from "../../redux/store";
import CodeBlockToolBar from "./CodeBlockToolbar";

const TopDiv = styled.div`
  border: 0.5px solid ${lightGray}80;
  border-radius: ${defaultBorderRadius};
  margin-bottom: 8px;
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
}) {
  const uiConfig = useUIConfig();
  const toolbarBottom = uiConfig?.codeBlockToolbarPosition == "bottom";

  const [hovering, setHovering] = useState(false);
  const [copyValue, setCopyValue] = useState("");

  const nextCodeBlockIndex = useSelector(
    (state: RootState) => state.uiState.nextCodeBlockToApplyIndex,
  );

  useEffect(() => {
    const debouncedEffect = debounce(() => {
      setCopyValue(childrenToText(props.children.props.children));
    }, 100);

    debouncedEffect();

    return () => {
      debouncedEffect.cancel();
    };
  }, [props.children]);

  return (
    <TopDiv
      tabIndex={-1}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <CodeBlockToolBar
        isNextCodeBlock={nextCodeBlockIndex === props.codeBlockIndex}
        text={copyValue}
        bottom={toolbarBottom}
        language={props.language}
      ></CodeBlockToolBar>
      {props.children}
    </TopDiv>
  );
}

export default PreWithToolbar;
