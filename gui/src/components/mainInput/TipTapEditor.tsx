import Document from "@tiptap/extension-document";
import History from "@tiptap/extension-history";
import Mention from "@tiptap/extension-mention";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import { Editor, EditorContent, JSONContent, useEditor } from "@tiptap/react";
import { ContextItemWithId, IContextProvider, RangeInFile } from "core";
import { getBasename } from "core/util";
import { useContext, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscForeground,
} from "..";
import { SearchContext } from "../../App";
import useHistory from "../../hooks/useHistory";
import { setTakenActionTrue } from "../../redux/slices/miscSlice";
import { RootStore } from "../../redux/store";
import { isMetaEquivalentKeyPressed } from "../../util";
import { isJetBrains, postToIde } from "../../util/ide";
import CodeBlockExtension from "./CodeBlockExtension";
import { SlashCommand } from "./CommandsExtension";
import InputToolbar from "./InputToolbar";
import "./TipTapEditor.css";
import { getCommandSuggestion, getMentionSuggestion } from "./getSuggestion";
import { ComboBoxItem } from "./types";

const InputBoxDiv = styled.div`
  resize: none;

  padding: 8px;
  padding-bottom: 24px;
  font-family: inherit;
  border-radius: ${defaultBorderRadius};
  margin: 0;
  height: auto;
  width: calc(100% - 18px);
  background-color: ${secondaryDark};
  color: ${vscForeground};
  z-index: 1;
  border: 0.5px solid ${lightGray};
  outline: none;
  font-size: 14px;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: ${lightGray}cc;
  }

  position: relative;
`;

interface TipTapEditorProps {
  availableContextProviders: IContextProvider[];
  availableSlashCommands: ComboBoxItem[];
  isMainInput: boolean;
  onEnter: (editorState: JSONContent) => void;

  editorState?: JSONContent;
  content?: string;
}

function TipTapEditor(props: TipTapEditorProps) {
  const dispatch = useDispatch();

  const [miniSearch, firstResults] = useContext(SearchContext);

  const historyLength = useSelector(
    (store: RootStore) => store.state.history.length
  );

  const [inputFocused, setInputFocused] = useState(false);

  const { saveSession } = useHistory(dispatch);

  const inSubmenu = useRef(false);
  const inDropdown = useRef(false);

  const enterSubmenu = async (editor: Editor) => {
    const contents = editor.getText();
    const indexOfAt = contents.lastIndexOf("@");
    if (indexOfAt === -1) {
      return;
    }

    editor.commands.deleteRange({
      from: indexOfAt + 2,
      to: contents.length + 1,
    });
    inSubmenu.current = true;

    // to trigger refresh of suggestions
    editor.commands.insertContent(" ");
    editor.commands.deleteRange({
      from: editor.state.selection.anchor - 1,
      to: editor.state.selection.anchor,
    });
  };

  const onClose = () => {
    inSubmenu.current = false;
    inDropdown.current = false;
  };

  const onOpen = () => {
    inDropdown.current = true;
  };

  const editor = useEditor(
    {
      extensions: [
        Document,
        History,
        Placeholder.configure({
          placeholder:
            historyLength === 0
              ? "Ask a question, '/' for slash commands, '@' to add context"
              : "Ask a follow-up",
        }),
        Paragraph.extend({
          addKeyboardShortcuts() {
            return {
              Enter: () => {
                if (inDropdown.current) {
                  return false;
                }

                props.onEnter(this.editor.getJSON());
                return true;
              },

              "Cmd-Enter": () => {
                props.onEnter(this.editor.getJSON());
                return true;
              },

              "Shift-Enter": () =>
                this.editor.commands.first(({ commands }) => [
                  () => commands.newlineInCode(),
                  () => commands.createParagraphNear(),
                  () => commands.liftEmptyBlock(),
                  () => commands.splitBlock(),
                ]),
            };
          },
        }).configure({
          HTMLAttributes: {
            class: "my-1",
          },
        }),
        Text,
        Mention.configure({
          HTMLAttributes: {
            class: "mention",
          },
          suggestion: getMentionSuggestion(
            props.availableContextProviders,
            miniSearch,
            firstResults,
            enterSubmenu,
            onClose,
            onOpen,
            inSubmenu
          ),
          renderLabel: (props) => {
            return `@${props.node.attrs.label || props.node.attrs.id}`;
          },
        }),
        SlashCommand.configure({
          HTMLAttributes: {
            class: "mention",
          },
          suggestion: getCommandSuggestion(
            props.availableSlashCommands,
            onClose,
            onOpen
          ),
          renderLabel: (props) => {
            return props.node.attrs.label;
          },
        }),
        CodeBlockExtension,
      ],
      editorProps: {
        attributes: {
          class: "outline-none -mt-1 overflow-hidden",
          style: "font-size: 14px;",
        },
      },
      content: props.editorState || props.content || "",
    },
    [
      props.availableContextProviders,
      historyLength,
      miniSearch,
      firstResults,
      inDropdown,
    ]
  );

  // This is a mechanism for overriding the IDE keyboard shortcut when inside of the webview
  const [ignoreHighlightedCode, setIgnoreHighlightedCode] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (
        isMetaEquivalentKeyPressed(event) &&
        (isJetBrains() ? event.code === "KeyJ" : event.code === "KeyM")
      ) {
        setIgnoreHighlightedCode(true);
        setTimeout(() => {
          setIgnoreHighlightedCode(false);
        }, 100);
      } else if (event.key === "Escape") {
        postToIde("focusEditor", {});
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // IDE event listeners
  useEffect(() => {
    if (!props.isMainInput) {
      return;
    }
    const handler = async (event: any) => {
      if (!editor) return;

      if (event.data.type === "userInput") {
        const input = event.data.input;
        editor.commands.insertContent(input);
        props.onEnter(editor.getJSON());
      } else if (event.data.type === "focusContinueInput") {
        if (historyLength > 0) {
          saveSession();
        }
        dispatch(setTakenActionTrue(null));
        editor.commands.focus("end");
      } else if (event.data.type === "focusContinueInputWithoutClear") {
        editor.commands.focus("end");
        dispatch(setTakenActionTrue(null));
      } else if (event.data.type === "focusContinueInputWithNewSession") {
        saveSession();
        dispatch(setTakenActionTrue(null));
        editor.commands.focus("end");
      } else if (event.data.type === "highlightedCode") {
        if (!ignoreHighlightedCode) {
          const rif: RangeInFile & { contents: string } =
            event.data.rangeInFileWithContents;
          const basename = getBasename(rif.filepath);
          const item: ContextItemWithId = {
            content: rif.contents,
            name: `${basename} (${rif.range.start.line + 1}-${
              rif.range.end.line + 1
            })`,
            description: rif.filepath,
            id: {
              providerTitle: "file",
              itemId: rif.filepath,
            },
          };
          editor.commands.insertContentAt(0, {
            type: "codeBlock",
            attrs: {
              item,
            },
          });
          await new Promise((resolve) => setTimeout(resolve, 100));
          editor.commands.focus("end");
        }
        setIgnoreHighlightedCode(false);
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [editor, props.isMainInput, historyLength, ignoreHighlightedCode]);

  return (
    <InputBoxDiv>
      <EditorContent
        editor={editor}
        onFocus={() => {
          setInputFocused(true);
        }}
        onBlur={() => {
          setInputFocused(false);
        }}
      />
      <InputToolbar
        hidden={!(inputFocused || props.isMainInput)}
        onAddContextItem={() => {
          if (editor.getText().endsWith("@")) {
          } else {
            editor.commands.insertContent("@");
          }
        }}
        onEnter={async () => {
          props.onEnter(editor.getJSON());
        }}
      />
    </InputBoxDiv>
  );
}

export default TipTapEditor;
