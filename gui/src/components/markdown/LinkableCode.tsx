import { useEffect, useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius, vscInputBackground } from "..";
import { postToIde } from "../../util/ide";

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
  const [linkingDone, setLinkingDone] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [filepath, setFilepath] = useState("");

  useEffect(() => {
    if (linkingDone) return;
    setLinkingDone(true);

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

    // Check if this is a real file
    // TODO
    let link = filename.slice(-4).includes(".");

    // setIsLink(link);
    setFilepath(filename);
  }, [linkingDone]);

  const onClick = () => {
    postToIde("showFile", { filepath });
  };

  return (
    <>
      {isLink}
      <StyledCode {...props} onClick={onClick} link={isLink} />
    </>
  );
}

export default LinkableCode;
