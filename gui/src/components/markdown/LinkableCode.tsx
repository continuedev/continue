import { useContext, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import styled from "styled-components";
import { defaultBorderRadius, vscInputBackground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { memoizedContextItemsSelector } from "../../redux/slices/stateSlice";

const StyledCode = styled.code<{ link: boolean }>`
  color: ${(props) => (props.link ? "#ff4343" : "#f78383")};
  word-wrap: break-word;
  border-radius: ${defaultBorderRadius};
  background-color: ${vscInputBackground};

  ${(props) => props.link && "cursor: pointer;"}
  &:hover {
    ${(props) => props.link && "text-decoration: underline;"}
  }
`;

function LinkableCode(props: any) {
  const ideMessenger = useContext(IdeMessengerContext);

  const contextItems = useSelector(memoizedContextItemsSelector);

  const [linkingDone, setLinkingDone] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [filepath, setFilepath] = useState("");
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (linkingDone) return;
    setLinkingDone(true);

    // Get filename from props.children
    let content: string | undefined = undefined;
    if (typeof props.children === "string") {
      content = props.children;
    } else if (
      Array.isArray(props.children) &&
      props.children.length > 0 &&
      typeof props.children[0] === "string"
    ) {
      content = props.children[0];
    }
    if (!content) return;

    // Check if this is a real file
    const contextItemFileMatch = contextItems.find(
      (item) =>
        item.id.providerTitle === "file" && item.description.endsWith(content),
    );
    if (contextItemFileMatch) {
      setIsLink(true);
      setFilepath(contextItemFileMatch.description);
      setLine(0);
    }

    if (content.length > 6) {
      const contextItemContentMatch = contextItems.find((item) =>
        item.content.includes(content),
      );
      if (contextItemContentMatch) {
        setIsLink(true);
        setFilepath(contextItemContentMatch.description);
        setLine(
          contextItemContentMatch.content
            .split("\n")
            .findIndex((line) => line.includes(content)) + 1,
        );
      }
    }
  }, [linkingDone, contextItems]);

  const onClick = () => {
    if (!isLink) return;
    ideMessenger.post("showLines", {
      filepath,
      startLine: line,
      endLine: line + 1,
    });
  };

  return (
    <>
      {isLink}
      <StyledCode {...props} onClick={onClick} link={isLink} />
    </>
  );
}

export default LinkableCode;
