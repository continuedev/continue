import Document from "@tiptap/extension-document";
import History from "@tiptap/extension-history";
import Image from "@tiptap/extension-image";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import { Editor, EditorContent, JSONContent, useEditor } from "@tiptap/react";
import {
  ContextItemWithId,
  ContextProviderDescription,
  RangeInFile,
} from "core";
import { modelSupportsImages } from "core/llm/autodetect";
import { getBasename } from "core/util";
import { useContext, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBadgeBackground,
  vscForeground,
  vscInputBackground,
  vscInputBorder,
  vscInputBorderFocus,
} from "..";
import { SubmenuContextProvidersContext } from "../../App";
import useHistory from "../../hooks/useHistory";
import useUpdatingRef from "../../hooks/useUpdatingRef";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { defaultModelSelector } from "../../redux/selectors/modelSelectors";
import { setEditingContextItemAtIndex } from "../../redux/slices/stateSlice";
import { RootState } from "../../redux/store";
import { isMetaEquivalentKeyPressed } from "../../util";
import { isJetBrains, postToIde } from "../../util/ide";
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

const HoverDiv = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  opacity: 0.5;
  background-color: ${vscBadgeBackground};
  color: ${vscForeground};
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HoverTextDiv = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  color: ${vscForeground};
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
`;

function getDataUrlForFile(file: File, img): string {
  const targetWidth = 512;
  const targetHeight = 512;
  const scaleFactor = Math.min(
    targetWidth / img.width,
    targetHeight / img.height,
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
  availableContextProviders: ContextProviderDescription[];
  availableSlashCommands: ComboBoxItem[];
  isMainInput: boolean;
  onEnter: (editorState: JSONContent) => void;

  editorState?: JSONContent;
}

function TipTapEditor(props: TipTapEditorProps) {
  const dispatch = useDispatch();

  const { getSubmenuContextItems } = useContext(SubmenuContextProvidersContext);

  const historyLength = useSelector(
    (store: RootState) => store.state.history.length,
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
    (store: RootState) => store.state.contextItems,
  );

  const defaultModel = useSelector(defaultModelSelector);

  const getSubmenuContextItemsRef = useUpdatingRef(getSubmenuContextItems);
  const availableContextProvidersRef = useUpdatingRef(
    props.availableContextProviders,
  );

  const historyLengthRef = useUpdatingRef(historyLength);
  const availableSlashCommandsRef = useUpdatingRef(
    props.availableSlashCommands,
  );

  async function handleImageFile(
    file: File,
  ): Promise<[HTMLImageElement, string] | undefined> {
    let filesize = file.size / 1024 / 1024; // filesize in MB
    // check image type and size
    if (
      [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/svg",
        "image/webp",
      ].includes(file.type) &&
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
      postToIde("errorPopup", {
        message:
          "Images need to be in jpg or png format and less than 10MB in size.",
      });
    }
    return undefined;
  }

  const editor: Editor = useEditor({
    extensions: [
      Document,
      History,
      Image,
      Placeholder.configure({
        placeholder: () =>
          historyLengthRef.current === 0
            ? "Ask anything, '/' for slash commands, '@' to add context"
            : "Ask a follow-up",
      }),
      Paragraph.extend({
        addKeyboardShortcuts() {
          return {
            Enter: () => {
              if (inDropdownRef.current) {
                return false;
              }

              onEnterRef.current();
              return true;
            },

            "Cmd-Enter": () => {
              onEnterRef.current();
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
          inSubmenuRef,
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
          onOpen,
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
              setEditingContextItemAtIndex({ item: codeBlock.attrs.item }),
            );
            return;
          }
        }
      }
    },
  });

  const onEnterRef = useUpdatingRef(() => {
    const json = editor.getJSON();

    // Don't do anything if input box is empty
    if (!json.content?.some((c) => c.content)) {
      return;
    }

    props.onEnter(json);

    if (props.isMainInput) {
      editor.commands.clearContent(true);
    }
  }, [props.onEnter, editor, props.isMainInput]);

  // This is a mechanism for overriding the IDE keyboard shortcut when inside of the webview
  const [ignoreHighlightedCode, setIgnoreHighlightedCode] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: any) => {
      if (
        isMetaEquivalentKeyPressed(event) &&
        (isJetBrains() ? event.code === "KeyJ" : event.code === "KeyL")
      ) {
        setIgnoreHighlightedCode(true);
        setTimeout(() => {
          setIgnoreHighlightedCode(false);
        }, 100);
      } else if (event.key === "Escape") {
        postToIde("focusEditor", undefined);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Re-focus main input after done generating
  const active = useSelector((state: RootState) => state.state.active);
  useEffect(() => {
    if (editor && !active && props.isMainInput) {
      editor.commands.focus();
    }
  }, [props.isMainInput, active, editor]);

  // IDE event listeners
  useWebviewListener(
    "userInput",
    async (data) => {
      if (!props.isMainInput) {
        return;
      }
      editor?.commands.insertContent(data.input);
      onEnterRef.current();
    },
    [editor, onEnterRef.current, props.isMainInput],
  );

  useWebviewListener(
    "focusContinueInput",
    async (data) => {
      if (!props.isMainInput) {
        return;
      }
      if (historyLength > 0) {
        saveSession();
      }
      setTimeout(() => {
        editor?.commands.focus("end");
      }, 20);
    },
    [historyLength, saveSession, editor, props.isMainInput],
  );

  useWebviewListener(
    "focusContinueInputWithoutClear",
    async () => {
      if (!props.isMainInput) {
        return;
      }
      setTimeout(() => {
        editor?.commands.focus("end");
      }, 20);
    },
    [editor, props.isMainInput],
  );

  useWebviewListener(
    "focusContinueInputWithNewSession",
    async () => {
      if (!props.isMainInput) {
        return;
      }
      saveSession();
      setTimeout(() => {
        editor?.commands.focus("end");
      }, 20);
    },
    [editor, props.isMainInput],
  );

  useWebviewListener(
    "highlightedCode",
    async (data) => {
      if (!props.isMainInput || !editor) {
        return;
      }
      if (!ignoreHighlightedCode) {
        const rif: RangeInFile & { contents: string } =
          data.rangeInFileWithContents;
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
        }, 200);
      }
      setIgnoreHighlightedCode(false);
    },
    [
      editor,
      props.isMainInput,
      historyLength,
      ignoreHighlightedCode,
      props.isMainInput,
    ],
  );

  useEffect(() => {
    if (props.isMainInput && editor && document.hasFocus()) {
      editor.commands.focus();
      // setTimeout(() => {
      //   // https://github.com/continuedev/continue/pull/881
      //   editor.commands.blur();
      // }, 0);
    }
  }, [editor, props.isMainInput, historyLength, ignoreHighlightedCode]);

  const [showDragOverMsg, setShowDragOverMsg] = useState(false);

  useEffect(() => {
    const overListener = (event: DragEvent) => {
      if (event.shiftKey) return;
      setShowDragOverMsg(true);
    };
    window.addEventListener("dragover", overListener);

    const leaveListener = (event: DragEvent) => {
      if (event.shiftKey) {
        setShowDragOverMsg(false);
      } else {
        setTimeout(() => setShowDragOverMsg(false), 2000);
      }
    };
    window.addEventListener("dragleave", leaveListener);

    return () => {
      window.removeEventListener("dragover", overListener);
      window.removeEventListener("dragleave", leaveListener);
    };
  }, []);

  return (
    <InputBoxDiv
      className="cursor-text"
      onClick={() => {
        editor && editor.commands.focus();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setShowDragOverMsg(true);
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget === null) {
          if (e.shiftKey) {
            setShowDragOverMsg(false);
          } else {
            setTimeout(() => setShowDragOverMsg(false), 2000);
          }
        }
      }}
      onDragEnter={() => {
        setShowDragOverMsg(true);
      }}
      onDrop={(event) => {
        if (!modelSupportsImages(defaultModel.provider, defaultModel.model)) {
          return;
        }
        setShowDragOverMsg(false);
        let file = event.dataTransfer.files[0];
        handleImageFile(file).then(([img, dataUrl]) => {
          const { schema } = editor.state;
          const node = schema.nodes.image.create({ src: dataUrl });
          const tr = editor.state.tr.insert(0, node);
          editor.view.dispatch(tr);
        });
        event.preventDefault();
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
        onEnter={onEnterRef.current}
        onImageFileSelected={(file) => {
          handleImageFile(file).then(([img, dataUrl]) => {
            const { schema } = editor.state;
            const node = schema.nodes.image.create({ src: dataUrl });
            editor.commands.command(({ tr }) => {
              tr.insert(0, node);
              return true;
            });
          });
        }}
      />
      {showDragOverMsg &&
        modelSupportsImages(defaultModel.provider, defaultModel.model) && (
          <>
            <HoverDiv></HoverDiv>
            <HoverTextDiv>Hold ⇧ to drop image</HoverTextDiv>
          </>
        )}
    </InputBoxDiv>
  );
}

export default TipTapEditor;
