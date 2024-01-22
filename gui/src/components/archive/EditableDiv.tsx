import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscForeground,
  vscInputBackground,
} from "..";
import { getFontSize } from "../../util";

const Div = styled.div<{ fontSize?: number }>`
  resize: none;

  padding: 8px;
  font-size: ${(props) => props.fontSize || getFontSize()}px;
  font-family: inherit;
  border-radius: ${defaultBorderRadius};
  margin: 8px auto;
  height: auto;
  width: 100%;
  background-color: ${vscInputBackground};
  color: ${vscForeground};
  z-index: 1;
  border: 1px solid transparent;

  &:focus {
    outline: 1px solid ${lightGray};
    border: 1px solid transparent;
  }

  &::placeholder {
    color: ${lightGray}80;
  }
`;

const Span = styled.span<{ color?: string }>`
  background-color: ${(props) => props.color || "#2cf8"};
  border-radius: ${defaultBorderRadius};
  padding: 2px 4px;
`;

interface EditableDivProps {
  onChange: (e: any) => void;
  value?: string;
}

function EditableDiv(props: EditableDivProps) {
  return (
    <Div
      fontSize={getFontSize()}
      suppressContentEditableWarning={true}
      contentEditable={true}
      onChange={(e) => {
        const target = e.target as HTMLTextAreaElement;
        // Update the height of the textarea to match the content, up to a max of 200px.
        target.style.height = "auto";
        target.style.height = `${Math.min(
          target.scrollHeight,
          300
        ).toString()}px`;

        // setShowContextDropdown(target.value.endsWith("@"));
        props.onChange(e);
      }}
      onKeyDown={(e) => {
        // if (e.key === "Delete") {
        //   // Delete spans if they are last child
        //   const selection = window.getSelection();
        //   const range = selection?.getRangeAt(0);
        //   const node = range?.startContainer;
        //   console.log("Del");
        //   if (node?.nodeName === "SPAN") {
        //     console.log("span");
        //     const parent = node.parentNode;
        //     if (parent?.childNodes.length === 1) {
        //       parent.removeChild(node);
        //     }
        //   }
        // }
      }}
    >
      {props.value ? props.value : <Span contentEditable={false}>testing</Span>}
    </Div>
  );
}

export default EditableDiv;
