import { RangeInFile } from "core";
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
  const [rif, setRif] = useState<undefined | RangeInFile>(undefined);

  useEffect(() => {
    if (linkingDone) return;
    setLinkingDone(true);

    // Get content of the code tag
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

    // Match filepath with context items
    const contextItemFileMatch = contextItems.find(
      (item) =>
        ["file", "codebase", "folder"].includes(item.id.providerTitle) &&
        item.description.split(" (")[0].endsWith(content),
    );
    if (contextItemFileMatch) {
      setIsLink(true);
      if (contextItemFileMatch.description.includes(" (")) {
        // Get line number from filename
        const [startLine, _] = contextItemFileMatch.description
          .split(" (")[1]
          .split(")")[0]
          .split("-");
        const filepath = contextItemFileMatch.description.split(" (")[0];
        setRif({
          filepath,
          range: {
            start: {
              line: 0,
              character: 0,
            },
            end: {
              line: 0,
              character: 0,
            },
          },
        });
        return;
      } else {
        // If no line number, just open the file
        setRif({
          filepath: contextItemFileMatch.description.split(" (")[0],
          range: {
            start: {
              line: 0,
              character: 0,
            },
            end: {
              line: 0,
              character: 0,
            },
          },
        });
        return;
      }
    }

    // Try to match the content with a line in a file
    if (content.length > 8) {
      const contextItemContentMatch = contextItems.find(
        (item) =>
          ["file", "codebase", "folder"].includes(item.id.providerTitle) &&
          item.content.includes(content),
      );
      if (contextItemContentMatch) {
        const line = contextItemContentMatch.content
          .split("\n")
          .slice(1) // code block fence
          .findIndex((line) => line.includes(content));

        const [filepath, rest] =
          contextItemContentMatch.description.split(" (");

        setIsLink(true);

        if (rest) {
          const [startLine, endLine] = rest.split(")")[0]?.split("-") || [
            "0",
            "0",
          ];
          const start = parseInt(startLine);
          const end = parseInt(endLine);
          setRif({
            filepath,
            range: {
              start: {
                line: start + line,
                character: 0,
              },
              end: {
                line: start + line + 1,
                character: 0,
              },
            },
          });
        } else {
          setRif({
            filepath,
            range: {
              start: {
                line: 0,
                character: 0,
              },
              end: {
                line: 0,
                character: 0,
              },
            },
          });
        }
      }
    }
  }, [linkingDone, contextItems]);

  const onClick = () => {
    if (!isLink) return;
    if (!rif) return;
    ideMessenger.post("showLines", {
      filepath: rif.filepath,
      startLine: rif.range.start.line,
      endLine: rif.range.end.line,
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
