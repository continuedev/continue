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
  InputModifiers,
  RangeInFile,
} from "core";
import { modelSupportsImages } from "core/llm/autodetect";
import { getBasename, getRelativePath } from "core/util";
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
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { SubmenuContextProvidersContext } from "../../context/SubmenuContextProviders";
import useHistory from "../../hooks/useHistory";
import { useInputHistory } from "../../hooks/useInputHistory";
import useUpdatingRef from "../../hooks/useUpdatingRef";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { selectUseActiveFile } from "../../redux/selectors";
import { defaultModelSelector } from "../../redux/selectors/modelSelectors";
import {
  consumeMainEditorContent,
  setEditingContextItemAtIndex,
} from "../../redux/slices/stateSlice";
import { RootState } from "../../redux/store";
import {
  getFontSize,
  isJetBrains,
  isMetaEquivalentKeyPressed,
} from "../../util";
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
  font-size: ${getFontSize()}px;

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
  onEnter: (editorState: JSONContent, modifiers: InputModifiers) => void;

  editorState?: JSONContent;
}

function TipTapEditor(props: TipTapEditorProps) {
  const dispatch = useDispatch();

  const ideMessenger = useContext(IdeMessengerContext);
  const { getSubmenuContextItems } = useContext(SubmenuContextProvidersContext);

  const historyLength = useSelector(
    (store: RootState) => store.state.history.length,
  );
  const useActiveFile = useSelector(selectUseActiveFile);

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

  const active = useSelector((state: RootState) => state.state.active);
  const activeRef = useUpdatingRef(active);

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
      ideMessenger.post("errorPopup", {
        message:
          "Images need to be in jpg or png format and less than 10MB in size.",
      });
    }
    return undefined;
  }

  const mainEditorContent = useSelector(
    (store: RootState) => store.state.mainEditorContent,
  );

  const { prevRef, nextRef, addRef } = useInputHistory();

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

              onEnterRef.current({
                useCodebase: false,
                noContext: !useActiveFile,
              });
              return true;
            },

            "Cmd-Enter": () => {
              onEnterRef.current({
                useCodebase: true,
                noContext: !useActiveFile,
              });
              return true;
            },
            "Alt-Enter": () => {
              onEnterRef.current({
                useCodebase: false,
                noContext: useActiveFile,
              });
              return true;
            },
            "Cmd-Backspace": () => {
              // If you press cmd+backspace wanting to cancel,
              // but are inside of a text box, it shouldn't
              // delete the text
              if (activeRef.current) {
                return true;
              }
            },
            "Shift-Enter": () =>
              this.editor.commands.first(({ commands }) => [
                () => commands.newlineInCode(),
                () => commands.createParagraphNear(),
                () => commands.liftEmptyBlock(),
                () => commands.splitBlock(),
              ]),

            ArrowUp: () => {
              if (this.editor.state.selection.anchor > 1) {
                return false;
              }

              const previousInput = prevRef.current(
                this.editor.state.toJSON().doc,
              );
              if (previousInput) {
                this.editor.commands.setContent(previousInput);
                setTimeout(() => {
                  this.editor.commands.blur();
                  this.editor.commands.focus("start");
                }, 0);
                return true;
              }
            },
            ArrowDown: () => {
              if (
                this.editor.state.selection.anchor <
                this.editor.state.doc.content.size - 1
              ) {
                return false;
              }
              const nextInput = nextRef.current();
              if (nextInput) {
                this.editor.commands.setContent(nextInput);
                setTimeout(() => {
                  this.editor.commands.blur();
                  this.editor.commands.focus("end");
                }, 0);
                return true;
              }
            },
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
          ideMessenger,
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
          ideMessenger,
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
        style: `font-size: ${getFontSize()}px;`,
      },
    },
    content: props.editorState || mainEditorContent || "",
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

  const editorFocusedRef = useUpdatingRef(editor?.isFocused, [editor]);

  useEffect(() => {
    if (isJetBrains()) {
      // This is only for VS Code .ipynb files
      return;
    }

    const handleKeyDown = async (event: KeyboardEvent) => {
      if (!editor || !editorFocusedRef.current) return;

      if (event.metaKey && event.key === "x") {
        document.execCommand("cut");
        event.stopPropagation();
        event.preventDefault();
      } else if (event.metaKey && event.key === "v") {
        document.execCommand("paste");
        event.stopPropagation();
        event.preventDefault();
      } else if (event.metaKey && event.key === "c") {
        document.execCommand("copy");
        event.stopPropagation();
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, editorFocusedRef]);

  useEffect(() => {
    if (mainEditorContent && editor) {
      editor.commands.setContent(mainEditorContent);
      dispatch(consumeMainEditorContent());
    }
  }, [mainEditorContent, editor]);

  const onEnterRef = useUpdatingRef(
    (modifiers: InputModifiers) => {
      const json = editor.getJSON();

      // Don't do anything if input box is empty
      if (!json.content?.some((c) => c.content)) {
        return;
      }

      props.onEnter(json, modifiers);

      if (props.isMainInput) {
        const content = editor.state.toJSON().doc;
        addRef.current(content);
        editor.commands.clearContent(true);
      }
    },
    [props.onEnter, editor, props.isMainInput],
  );

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
        ideMessenger.post("focusEditor", undefined);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Re-focus main input after done generating
  useEffect(() => {
    if (editor && !active && props.isMainInput && document.hasFocus()) {
      editor.commands.focus(undefined, { scrollIntoView: false });
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
      onEnterRef.current({ useCodebase: false, noContext: true });
    },
    [editor, onEnterRef.current, props.isMainInput],
  );

  useWebviewListener("jetbrains/editorInsetRefresh", async () => {
    editor?.chain().clearContent().focus().run();
  });

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
        editor?.commands.blur();
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
        const relativePath = getRelativePath(rif.filepath, await ideMessenger.ide.getWorkspaceDirs());
        const rangeStr = `(${rif.range.start.line + 1}-${rif.range.end.line + 1})`;
        const item: ContextItemWithId = {
          content: rif.contents,
          name: `${basename} ${rangeStr}`,
          // Description is passed on to the LLM to give more context on file path
          description: `${relativePath} ${rangeStr}`,
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
          editor.commands.blur();
          editor.commands.focus("end");
        }, 20);
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

  // On linux+jetbrains only was stealing focus
  // useEffect(() => {
  //   if (props.isMainInput && editor && document.hasFocus()) {
  //     editor.commands.focus();
  //     // setTimeout(() => {
  //     //   // https://github.com/continuedev/continue/pull/881
  //     //   editor.commands.blur();
  //     // }, 0);
  //   }
  // }, [editor, props.isMainInput, historyLength, ignoreHighlightedCode]);

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

  const [optionKeyHeld, setOptionKeyHeld] = useState(false);

  return (
    <InputBoxDiv
      onKeyDown={(e) => {
        if (e.key === "Alt") {
          setOptionKeyHeld(true);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Alt") {
          setOptionKeyHeld(false);
        }
      }}
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
        if (
          !modelSupportsImages(
            defaultModel.provider,
            defaultModel.model,
            defaultModel.title,
          )
        ) {
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
        spellCheck={false}
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
        showNoContext={optionKeyHeld}
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
        modelSupportsImages(
          defaultModel.provider,
          defaultModel.model,
          defaultModel.title,
        ) && (
          <>
            <HoverDiv></HoverDiv>
            <HoverTextDiv>Hold ⇧ to drop image</HoverTextDiv>
          </>
        )}
    </InputBoxDiv>
  );
}

export default TipTapEditor;
