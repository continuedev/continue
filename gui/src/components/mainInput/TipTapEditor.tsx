import Document from "@tiptap/extension-document";
import History from "@tiptap/extension-history";
import Mention from "@tiptap/extension-mention";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import { EditorContent, JSONContent, useEditor } from "@tiptap/react";
import { IContextProvider } from "core";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscForeground,
} from "..";
import useHistory from "../../hooks/useHistory";
import { setTakenActionTrue } from "../../redux/slices/miscSlice";
import { RootStore } from "../../redux/store";
import { postToIde } from "../../util/ide";
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
  width: 100%;
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

  const historyLength = useSelector(
    (store: RootStore) => store.state.history.length
  );

  const contextProviders = useSelector(
    (state: RootStore) => state.state.config.contextProviders || []
  );

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
              //       props.onEnter(collectInput(editor));
              //       return true;
              //     },
              //   ]),

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
          suggestion: getMentionSuggestion(props.availableContextProviders),
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
      ],
      editorProps: {
        attributes: {
          class: "outline-none -mt-1 overflow-hidden",
          style: "font-size: 14px;",
        },
      },
      content: props.editorState || props.content || "",
    },
    [props.availableContextProviders, historyLength]
  );

  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    if (!editor) return;

    if (props.isMainInput) {
      editor.commands.focus();
    }
    const handler = (event: any) => {
      if (event.data.type === "focusContinueInput") {
        editor.commands.focus();
        if (historyLength > 0) {
          saveSession();
        }
        dispatch(setTakenActionTrue(null));
      } else if (event.data.type === "focusContinueInputWithEdit") {
        editor.commands.focus();
        if (historyLength > 0) {
          saveSession();
        }

        if (!editor.getText().startsWith("/edit")) {
          editor.commands.insertContentAt(0, "/edit ");
        }
        dispatch(setTakenActionTrue(null));
      } else if (event.data.type === "focusContinueInputWithNewSession") {
        saveSession();
        dispatch(setTakenActionTrue(null));
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [editor, props.isMainInput, historyLength]);

  return (
    <InputBoxDiv>
      <EditorContent
        editor={editor}
        onFocus={() => {
          setInputFocused(true);
        }}
        onBlur={(e) => {
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
