import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { ContextItemWithId } from "core";
import { useDispatch, useSelector } from "react-redux";
import { vscBadgeBackground } from "..";
import { setEditingContextItemAtIndex } from "../../redux/slices/stateSlice";
import { RootState } from "../../redux/store";
import CodeSnippetPreview from "../markdown/CodeSnippetPreview";

const CodeBlockComponent = ({
  node,
  deleteNode,
  selected,
  editor,
  updateAttributes,
}) => {
  const dispatch = useDispatch();
  const item: ContextItemWithId = node.attrs.item;

  const contextItems = useSelector(
    (state: RootState) => state.state.contextItems
  );
  return (
    <NodeViewWrapper className="code-block-with-content" as="p">
      <CodeSnippetPreview
        borderColor={
          item.id === contextItems[0]?.id
            ? "#d0d"
            : selected
            ? vscBadgeBackground
            : undefined
        }
        item={item}
        onDelete={() => {
          deleteNode();
        }}
        onEdit={async () => {
          dispatch(setEditingContextItemAtIndex({ item }));
          if (item.id === contextItems[0]?.id) {
            // Find and delete the /edit command
            let index = 0;
            for (const el of editor.getJSON().content) {
              if (el.type === "slashcommand") {
                if (el.attrs.id === "/edit") {
                  editor
                    .chain()
                    .deleteRange({ from: index, to: index + 2 })
                    .focus("end")
                    .run();
                  break;
                }
              }
              index += 1;
            }

            updateAttributes({
              item: {
                ...item,
                editing: false,
              },
            });
          } else {
            let index = 0;
            for (const el of editor.getJSON().content) {
              if (el.type === "codeBlock") {
                index += 2;
              } else {
                break;
              }
            }
            editor
              .chain()
              .focus("end")
              .insertContent([
                {
                  type: "slashcommand",
                  attrs: { id: "/edit", label: "/edit" },
                },
                { type: "text", text: " " },
              ])
              .run();

            updateAttributes({
              item: {
                ...item,
                editing: true,
              },
            });

            await new Promise((resolve) => setTimeout(resolve, 100));
            editor.commands.focus("end");
          }
        }}
        editing={item.id === contextItems[0]?.id}
      />
    </NodeViewWrapper>
  );
};

export default Node.create({
  name: "codeBlock",

  group: "block",

  content: "inline*",

  atom: true,

  selectable: true,

  parseHTML() {
    return [
      {
        tag: "code-block",
      },
    ];
  },

  addAttributes() {
    return {
      item: {
        default: "",
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return ["code-block", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
});
