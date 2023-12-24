import Document from "@tiptap/extension-document";
import History from "@tiptap/extension-history";
import Mention from "@tiptap/extension-mention";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import { EditorContent, JSONContent, useEditor } from "@tiptap/react";
import { ContextItemWithId, IContextProvider, RangeInFile } from "core";
import { useContext, useEffect, useState } from "react";
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
              // Enter: () =>
              //   this.editor.commands.first(({ commands }) => [
              //     () => {
              //       props.onEnter(this.editor.getJSON());
              //       return true;
              //     },
              //   ]),
              // Enter: () => true,

              "Shift-Enter": () =>
                this.editor.commands.first(({ commands }) => [
                  () => commands.newlineInCode(),
                  () => commands.createParagraphNear(),
                  () => commands.liftEmptyBlock(),
                  () => commands.splitBlock(),
                ]),
              Escape: () =>
                this.editor.commands.first(({ commands }) => [
                  () => {
                    postToIde("focusEditor", {});
                    return true;
                  },
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
            () => {
              const contents = editor.getText();
              const indexOfAt = contents.lastIndexOf("@");

              editor.commands.deleteRange({
                from: indexOfAt,
                to: contents.length,
              });

              editor.commands.focus();
            }
          ),
          renderLabel: (props) => {
            return `@${props.node.attrs.label || props.node.attrs.id}`;
          },
        }),
        SlashCommand.configure({
          HTMLAttributes: {
            class: "mention",
          },
          suggestion: getCommandSuggestion(props.availableSlashCommands),
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
    [props.availableContextProviders, historyLength, miniSearch, firstResults]
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
        editor.commands.focus();
        if (historyLength > 0) {
          saveSession();
        }
        dispatch(setTakenActionTrue(null));
      } else if (event.data.type === "focusContinueInputWithoutClear") {
        editor.commands.focus();
        dispatch(setTakenActionTrue(null));
      } else if (event.data.type === "focusContinueInputWithNewSession") {
        saveSession();
        dispatch(setTakenActionTrue(null));
      } else if (event.data.type === "highlightedCode") {
        if (!ignoreHighlightedCode) {
          const rif: RangeInFile & { contents: string } =
            event.data.rangeInFileWithContents;
          const basename = rif.filepath.split(/[\\/]/).pop();
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
        // onKeyDown={(e) => {
        //   if (e.key === "Enter") {
        //     props.onEnter(editor.getJSON());
        //   }
        // }}
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
