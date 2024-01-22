import Document from "@tiptap/extension-document";
import Dropcursor from "@tiptap/extension-dropcursor";
import History from "@tiptap/extension-history";
import Image from "@tiptap/extension-image";
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
  vscForeground,
  vscInputBackground,
  vscInputBorder,
  vscInputBorderFocus,
} from "..";
import { SubmenuContextProvidersContext } from "../../App";
import useHistory from "../../hooks/useHistory";
import useUpdatingRef from "../../hooks/useUpdatingRef";
import { setEditingContextItemAtIndex } from "../../redux/slices/stateSlice";
import { RootStore } from "../../redux/store";
import { isMetaEquivalentKeyPressed } from "../../util";
import { errorPopup, isJetBrains, postToIde } from "../../util/ide";
import CodeBlockExtension from "./CodeBlockExtension";
import { SlashCommand } from "./CommandsExtension";
import InputToolbar from "./InputToolbar";
import { Mention } from "./MentionExtension";
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
  background-color: ${vscInputBackground};
  color: ${vscForeground};
  z-index: 1;
  border: 0.5px solid ${vscInputBorder};
  outline: none;
  font-size: 14px;

  &:focus {
    outline: none;
    border: 0.5px solid ${vscInputBorderFocus};
  }

  &::placeholder {
    color: ${lightGray}cc;
  }

  position: relative;
`;

function getDataUrlForFile(file: File, img): string {
  const targetWidth = 512;
  const targetHeight = 512;
  const scaleFactor = Math.min(
    targetWidth / img.width,
    targetHeight / img.height
  );

  const canvas = document.createElement("canvas");
  canvas.width = img.width * scaleFactor;
  canvas.height = img.height * scaleFactor;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const downsizedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
  return downsizedDataUrl;
}

interface TipTapEditorProps {
  availableContextProviders: IContextProvider[];
  availableSlashCommands: ComboBoxItem[];
  isMainInput: boolean;
  onEnter: (editorState: JSONContent) => void;

  editorState?: JSONContent;
}

function TipTapEditor(props: TipTapEditorProps) {
  const dispatch = useDispatch();

  const getSubmenuContextItems = useContext(SubmenuContextProvidersContext);

  const historyLength = useSelector(
    (store: RootStore) => store.state.history.length
  );

  const [inputFocused, setInputFocused] = useState(false);

  const { saveSession } = useHistory(dispatch);

  const inSubmenuRef = useRef<string | undefined>(undefined);
  const inDropdownRef = useRef(false);

  const enterSubmenu = async (editor: Editor, providerId: string) => {
    const contents = editor.getText();
    const indexOfAt = contents.lastIndexOf("@");
    if (indexOfAt === -1) {
      return;
    }

    editor.commands.deleteRange({
      from: indexOfAt + 2,
      to: contents.length + 1,
    });
    inSubmenuRef.current = providerId;

    // to trigger refresh of suggestions
    editor.commands.insertContent(" ");
    editor.commands.deleteRange({
      from: editor.state.selection.anchor - 1,
      to: editor.state.selection.anchor,
    });
  };

  const onClose = () => {
    inSubmenuRef.current = undefined;
    inDropdownRef.current = false;
  };

  const onOpen = () => {
    inDropdownRef.current = true;
  };

  const contextItems = useSelector(
    (store: RootStore) => store.state.contextItems
  );

  const getSubmenuContextItemsRef = useUpdatingRef(getSubmenuContextItems);
  const availableContextProvidersRef = useUpdatingRef(
    props.availableContextProviders
  );

  const historyLengthRef = useUpdatingRef(historyLength);
  const onEnterRef = useUpdatingRef(props.onEnter);
  const availableSlashCommandsRef = useUpdatingRef(
    props.availableSlashCommands
  );

  async function handleImageFile(
    file: File
  ): Promise<[HTMLImageElement, string] | undefined> {
    let filesize = file.size / 1024 / 1024; // filesize in MB
    // check image type and size
    if (
      (file.type === "image/jpeg" || file.type === "image/png") &&
      filesize < 10
    ) {
      // check dimensions
      let _URL = window.URL || window.webkitURL;
      let img = new window.Image();
      img.src = _URL.createObjectURL(file);

      return await new Promise((resolve) => {
        img.onload = function () {
          const dataUrl = getDataUrlForFile(file, img);

          let image = new window.Image();
          image.src = dataUrl;
          image.onload = function () {
            resolve([image, dataUrl]);
          };
        };
      });
    } else {
      errorPopup(
        "Images need to be in jpg or png format and less than 10MB in size."
      );
    }
    return undefined;
  }

  const editor = useEditor({
    extensions: [
      Document,
      History,
      Image,
      Dropcursor,
      Placeholder.configure({
        placeholder: () =>
          historyLengthRef.current === 0
            ? "Ask a question, '/' for slash commands, '@' to add context"
            : "Ask a follow-up",
      }),
      Paragraph.extend({
        addKeyboardShortcuts() {
          return {
            Enter: () => {
              if (inDropdownRef.current) {
                return false;
              }

              onEnterRef.current(this.editor.getJSON());
              return true;
            },

            "Cmd-Enter": () => {
              onEnterRef.current(this.editor.getJSON());
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
          availableContextProvidersRef,
          getSubmenuContextItemsRef,
          enterSubmenu,
          onClose,
          onOpen,
          inSubmenuRef
        ),
        renderHTML: (props) => {
          return `@${props.node.attrs.label || props.node.attrs.id}`;
        },
      }),
      SlashCommand.configure({
        HTMLAttributes: {
          class: "mention",
        },
        suggestion: getCommandSuggestion(
          availableSlashCommandsRef,
          onClose,
          onOpen
        ),
        renderText: (props) => {
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
      handleDrop: function (view, event, slice, moved) {
        if (
          !moved &&
          event.dataTransfer &&
          event.dataTransfer.files &&
          event.dataTransfer.files[0]
        ) {
          let file = event.dataTransfer.files[0];
          handleImageFile(file).then(([img, dataUrl]) => {
            const { schema } = view.state;
            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            const node = schema.nodes.image.create({ src: dataUrl });
            const transaction = view.state.tr.insert(
              Math.max(0, coordinates.pos - 1),
              [node]
            );
            return view.dispatch(transaction);
          });

          return true;
        }
        return false;
      },
    },
    content: props.editorState || "",
    onUpdate: ({ editor, transaction }) => {
      // If /edit is typed and no context items are selected, select the first

      if (contextItems.length > 0) {
        return;
      }

      const json = editor.getJSON();
      let codeBlock = json.content?.find((el) => el.type === "codeBlock");
      if (!codeBlock) {
        return;
      }

      // Search for slashcommand type
      for (const p of json.content) {
        if (
          p.type !== "paragraph" ||
          !p.content ||
          typeof p.content === "string"
        ) {
          continue;
        }
        for (const node of p.content) {
          if (
            node.type === "slashcommand" &&
            ["/edit", "/comment"].includes(node.attrs.label)
          ) {
            // Update context items
            dispatch(
              setEditingContextItemAtIndex({ item: codeBlock.attrs.item })
            );
            return;
          }
        }
      }
    },
  });

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
    if (editor && document.hasFocus()) {
      editor.commands.focus();
    }
    const handler = async (event: any) => {
      if (!editor) return;

      if (event.data.type === "userInput") {
        const input = event.data.input;
        editor.commands.insertContent(input);
        onEnterRef.current(editor.getJSON());
      } else if (event.data.type === "focusContinueInput") {
        if (historyLength > 0) {
          saveSession();
        }
        editor.commands.focus("end");
      } else if (event.data.type === "focusContinueInputWithoutClear") {
        editor.commands.focus("end");
      } else if (event.data.type === "focusContinueInputWithNewSession") {
        saveSession();
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
              providerTitle: "code",
              itemId: rif.filepath,
            },
          };

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
            .insertContentAt(index, {
              type: "codeBlock",
              attrs: {
                item,
              },
            })
            .run();
          setTimeout(() => {
            editor.commands.focus("end");
          }, 100);
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
    <InputBoxDiv
      className="cursor-text"
      onClick={() => {
        editor && editor.commands.focus();
      }}
    >
      <EditorContent
        editor={editor}
        onFocus={() => {
          setInputFocused(true);
        }}
        onBlur={() => {
          // hack to stop from cancelling press of "Enter"
          setTimeout(() => {
            setInputFocused(false);
          }, 100);
        }}
        onClick={(event) => {
          event.stopPropagation();
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
        onEnter={() => {
          onEnterRef.current(editor.getJSON());
        }}
        onImageFileSelected={(file) => {
          handleImageFile(file).then(([img, dataUrl]) => {
            const { schema } = editor.state;
            const node = schema.nodes.image.create({ src: dataUrl });
            editor.state.tr.insert(0, node);
          });
        }}
      />
    </InputBoxDiv>
  );
}

export default TipTapEditor;
