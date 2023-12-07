import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius, secondaryDark } from "..";
import { useDispatch, useSelector } from "react-redux";
import { RootStore } from "../../redux/store";
import { postToIde } from "../../util/ide";

const StyledCode = styled.code<{ link: boolean }>`
  color: ${(props) => (props.link ? "#ff43433" : "#f78383")};
  word-wrap: break-word;
  border-radius: ${defaultBorderRadius};
  background-color: ${secondaryDark};

  ${(props) => props.link && "cursor: pointer;"}
  &:hover {
    ${(props) => props.link && "text-decoration: underline;"}
  }
`;

function LinkableCode(props: any) {
  const contextItems = useSelector(
    (store: RootStore) => store.sessionState.context_items
  );

  const [linkingDone, setLinkingDone] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [filepath, setFilepath] = useState("");
  useEffect(() => {
    if (linkingDone) return;

    // Get filename from props.children
    let filename: string | undefined = undefined;
    if (typeof props.children === "string") {
      filename = props.children;
    } else if (
      Array.isArray(props.children) &&
      props.children.length > 0 &&
      typeof props.children[0] === "string"
    ) {
      filename = props.children[0];
    }
    if (!filename) return;

    // Check if matches any context item's filepath
    let link = false;
    for (let contextItem of contextItems) {
      if (contextItem.description.endsWith(filename)) {
        link = true;
        setFilepath(contextItem.description);
        break;
      }
    }

    setIsLink(link);
    setLinkingDone(true);
  }, [linkingDone, contextItems]);

  const onClick = () => {
    postToIde("showFile", { filepath });
  };

  return <StyledCode {...props} onClick={onClick} link={isLink} />;
}

export default LinkableCode;
