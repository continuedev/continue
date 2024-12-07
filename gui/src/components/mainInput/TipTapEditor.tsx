import Document from "@tiptap/extension-document";
import History from "@tiptap/extension-history";
import Image from "@tiptap/extension-image";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import { Plugin } from "@tiptap/pm/state";
import { Editor, EditorContent, JSONContent, useEditor } from "@tiptap/react";
import {
  ContextItemWithId,
  ContextProviderDescription,
  InputModifiers,
  RangeInFile,
} from "core";
import { modelSupportsImages } from "core/llm/autodetect";
import { getBasename, getRelativePath } from "core/util";
import { debounce } from "lodash";
import { usePostHog } from "posthog-js/react";
import {
  KeyboardEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import styled from "styled-components";
import { v4 } from "uuid";
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
import { useSubmenuContextProviders } from "../../context/SubmenuContextProviders";
import useHistory from "../../hooks/useHistory";
import { useInputHistory } from "../../hooks/useInputHistory";
import useIsOSREnabled from "../../hooks/useIsOSREnabled";
import useUpdatingRef from "../../hooks/useUpdatingRef";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { selectUseActiveFile } from "../../redux/selectors";
import {
  getFontSize,
  isJetBrains,
  isMetaEquivalentKeyPressed,
} from "../../util";
import { AddCodeToEdit } from "./AddCodeToEditExtension";
import { CodeBlockExtension } from "./CodeBlockExtension";
import { SlashCommand } from "./CommandsExtension";
import InputToolbar, { ToolbarOptions } from "./InputToolbar";
import { Mention } from "./MentionExtension";
import "./TipTapEditor.css";
import {
  getContextProviderDropdownOptions,
  getSlashCommandDropdownOptions,
} from "./getSuggestion";
import {
  handleJetBrainsOSRMetaKeyIssues,
  handleVSCMetaKeyIssues,
} from "./handleMetaKeyIssues";
import { ComboBoxItem } from "./types";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectDefaultModel } from "../../redux/slices/configSlice";
import {
  addCodeToEdit,
  clearCodeToEdit,
  selectHasCodeToEdit,
  selectIsInEditMode,
} from "../../redux/slices/sessionSlice";
import { exitEditMode } from "../../redux/thunks";

const InputBoxDiv = styled.div<{ border?: string }>`
  resize: none;
  padding-bottom: 4px;
  font-family: inherit;
  border-radius: ${defaultBorderRadius};
  margin: 0;
  height: auto;
  width: 100%;
  background-color: ${vscInputBackground};
  color: ${vscForeground};
  border: ${(props) =>
    props.border ? props.border : `0.5px solid ${vscInputBorder}`};
  outline: none;
  font-size: ${getFontSize()}px;

  &:focus {
    outline: none;

    border: 0.5px solid ${vscInputBorderFocus};
  }

  &::placeholder {
    color: ${lightGray}cc;
  }

  display: flex;
  flex-direction: column;
`;

const PaddingDiv = styled.div`
  padding: 8px 12px;
  padding-bottom: 4px;
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
  display: flex;
  align-items: center;
  justify-content: center;
`;

const IMAGE_RESOLUTION = 1024;
function getDataUrlForFile(
  file: File,
  img: HTMLImageElement,
): string | undefined {
  const targetWidth = IMAGE_RESOLUTION;
  const targetHeight = IMAGE_RESOLUTION;
  const scaleFactor = Math.min(
    targetWidth / img.width,
    targetHeight / img.height,
  );

  const canvas = document.createElement("canvas");
  canvas.width = img.width * scaleFactor;
  canvas.height = img.height * scaleFactor;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Error getting image data url: 2d context not found");
    return;
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const downsizedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
  return downsizedDataUrl;
}

interface TipTapEditorProps {
  availableContextProviders: ContextProviderDescription[];
  availableSlashCommands: ComboBoxItem[];
  isMainInput: boolean;
  onEnter: (
    editorState: JSONContent,
    modifiers: InputModifiers,
    editor: Editor,
  ) => void;
  editorState?: JSONContent;
  toolbarOptions?: ToolbarOptions;
  border?: string;
  placeholder?: string;
  historyKey: string;
}

function TipTapEditor(props: TipTapEditorProps) {
  const dispatch = useAppDispatch();

  const ideMessenger = useContext(IdeMessengerContext);
  const { getSubmenuContextItems } = useSubmenuContextProviders();

  const historyLength = useAppSelector((store) => store.session.history.length);

  const useActiveFile = useAppSelector(selectUseActiveFile);

  const { saveSession, loadSession, loadLastSession } = useHistory(dispatch);

  const posthog = usePostHog();

  const inSubmenuRef = useRef<string | undefined>(undefined);
  const inDropdownRef = useRef(false);

  const isOSREnabled = useIsOSREnabled();

  const enterSubmenu = async (editor: Editor, providerId: string) => {
    const contents = editor.getText();
    const indexOfAt = contents.lastIndexOf("@");
    if (indexOfAt === -1) {
      return;
    }

    // Find the position of the last @ character
    // We do this because editor.getText() isn't a correct representation including node views
    let startPos = editor.state.selection.anchor;
    while (
      startPos > 0 &&
      editor.state.doc.textBetween(startPos, startPos + 1) !== "@"
    ) {
      startPos--;
    }
    startPos++;

    editor.commands.deleteRange({
      from: startPos,
      to: editor.state.selection.anchor,
    });
    inSubmenuRef.current = providerId;

    // to trigger refresh of suggestions
    editor.commands.insertContent(":");
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

  const defaultModel = useAppSelector(selectDefaultModel);
  const defaultModelRef = useUpdatingRef(defaultModel);

  const getSubmenuContextItemsRef = useUpdatingRef(getSubmenuContextItems);
  const availableContextProvidersRef = useUpdatingRef(
    props.availableContextProviders,
  );

  const historyLengthRef = useUpdatingRef(historyLength);
  const availableSlashCommandsRef = useUpdatingRef(
    props.availableSlashCommands,
  );

  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const isStreamingRef = useUpdatingRef(isStreaming);

  const isInEditMode = useAppSelector(selectIsInEditMode);
  const isInEditModeRef = useUpdatingRef(isInEditMode);
  const hasCodeToEdit = useAppSelector(selectHasCodeToEdit);
  const isEditModeAndNoCodeToEdit = isInEditMode && !hasCodeToEdit;

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
          if (!dataUrl) {
            return;
          }

          let image = new window.Image();
          image.src = dataUrl;
          image.onload = function () {
            resolve([image, dataUrl]);
          };
        };
      });
    } else {
      ideMessenger.post("showToast", [
        "error",
        "Images need to be in jpg or png format and less than 10MB in size.",
      ]);
    }
    return undefined;
  }

  const mainEditorContent = useAppSelector(
    (store) => store.session.mainEditorContent,
  );

  const { prevRef, nextRef, addRef } = useInputHistory(props.historyKey);

  const editor: Editor = useEditor({
    extensions: [
      Document,
      History,
      Image.extend({
        addProseMirrorPlugins() {
          const plugin = new Plugin({
            props: {
              handleDOMEvents: {
                paste(view, event) {
                  const model = defaultModelRef.current;
                  if (!model) return;
                  const items = event.clipboardData?.items;
                  if (items) {
                    for (const item of items) {
                      const file = item.getAsFile();
                      file &&
                        modelSupportsImages(
                          model.provider,
                          model.model,
                          model.title,
                          model.capabilities,
                        ) &&
                        handleImageFile(file).then((resp) => {
                          if (!resp) return;
                          const [img, dataUrl] = resp;
                          const { schema } = view.state;
                          const node = schema.nodes.image.create({
                            src: dataUrl,
                          });
                          const tr = view.state.tr.insert(0, node);
                          view.dispatch(tr);
                        });
                    }
                  }
                },
              },
            },
          });
          return [plugin];
        },
      }),
      Placeholder.configure({
        placeholder: getPlaceholderText(
          props.placeholder,
          historyLengthRef.current,
        ),
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

            "Mod-Enter": () => {
              onEnterRef.current({
                useCodebase: true,
                noContext: !useActiveFile,
              });
              return true;
            },
            "Alt-Enter": () => {
              posthog.capture("gui_use_active_file_enter");

              onEnterRef.current({
                useCodebase: false,
                noContext: useActiveFile,
              });

              return true;
            },
            "Mod-Backspace": () => {
              // If you press cmd+backspace wanting to cancel,
              // but are inside of a text box, it shouldn't
              // delete the text
              if (isStreamingRef.current) {
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
            Escape: () => {
              if (inDropdownRef.current || !isInEditModeRef.current) {
                return false;
              }

              loadLastSession().catch((e) =>
                console.error(`Failed to load last session: ${e}`),
              );

              dispatch(exitEditMode());

              return true;
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
        suggestion: getContextProviderDropdownOptions(
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

      AddCodeToEdit.configure({
        HTMLAttributes: {
          class: "add-code-to-edit",
        },
        suggestion: {
          ...getContextProviderDropdownOptions(
            availableContextProvidersRef,
            getSubmenuContextItemsRef,
            enterSubmenu,
            onClose,
            onOpen,
            inSubmenuRef,
            ideMessenger,
          ),
          allow: () => isInEditModeRef.current,
          command: async ({ editor, range, props }) => {
            editor.chain().focus().insertContentAt(range, "").run();
            const filepath = props.id;
            const contents = await ideMessenger.ide.readFile(filepath);
            dispatch(
              addCodeToEdit({
                filepath,
                contents,
              }),
            );
          },
          items: async ({ query }) => {
            // Only display files in the dropdown
            const results = getSubmenuContextItemsRef.current("file", query);
            return results.map((result) => ({
              ...result,
              label: result.title,
              type: "file",
              query: result.id,
              icon: result.icon,
            }));
          },
        },
      }),
      props.availableSlashCommands.length
        ? SlashCommand.configure({
            HTMLAttributes: {
              class: "mention",
            },
            suggestion: getSlashCommandDropdownOptions(
              availableSlashCommandsRef,
              onClose,
              onOpen,
              ideMessenger,
            ),
            renderText: (props) => {
              return props.node.attrs.label;
            },
          })
        : undefined,
      CodeBlockExtension,
    ],
    editorProps: {
      attributes: {
        class: "outline-none -mt-1 overflow-hidden",
        style: `font-size: ${getFontSize()}px;`,
      },
    },
    content: props.editorState || mainEditorContent || "",
    editable: !isStreaming || props.isMainInput,
  });

  const [shouldHideToolbar, setShouldHideToolbar] = useState(false);
  const debouncedShouldHideToolbar = debounce((value) => {
    setShouldHideToolbar(value);
  }, 200);

  function getPlaceholderText(
    placeholder: TipTapEditorProps["placeholder"],
    historyLength: number,
  ) {
    if (placeholder) {
      return placeholder;
    }

    return historyLength === 0
      ? "Ask anything, '@' to add context"
      : "Ask a follow-up";
  }

  useEffect(() => {
    const placeholder = getPlaceholderText(
      props.placeholder,
      historyLengthRef.current,
    );

    editor.extensionManager.extensions.filter(
      (extension) => extension.name === "placeholder",
    )[0].options["placeholder"] = placeholder;

    editor.view.dispatch(editor.state.tr);
  }, [editor, props.placeholder, historyLengthRef.current]);

  useEffect(() => {
    if (props.isMainInput) {
      editor.commands.clearContent(true);
    }
  }, [isInEditMode, props.isMainInput]);

  useEffect(() => {
    if (editor) {
      const handleFocus = () => {
        debouncedShouldHideToolbar(false);
      };

      const handleBlur = () => {
        debouncedShouldHideToolbar(true);
      };

      editor.on("focus", handleFocus);
      editor.on("blur", handleBlur);

      return () => {
        editor.off("focus", handleFocus);
        editor.off("blur", handleBlur);
      };
    }
  }, [editor]);

  const editorFocusedRef = useUpdatingRef(editor?.isFocused, [editor]);

  /**
   * This handles various issues with meta key actions
   * - In JetBrains, when using OSR in JCEF, there is a bug where using the meta key to
   *   highlight code using arrow keys is not working
   * - In VS Code, while working with .ipynb files there is a problem where copy/paste/cut will affect
   *   the actual notebook cells, even when performing them in our GUI
   *
   *  Currently keydown events for a number of keys are not registering if the
   *  meta/shift key is pressed, for example "x", "c", "v", "z", etc.
   *  Until this is resolved we can't turn on OSR for non-Mac users due to issues
   *  with those key actions.
   */
  const handleKeyDown = async (e: KeyboardEvent<HTMLDivElement>) => {
    setActiveKey(e.key);

    if (!editorFocusedRef?.current || !isMetaEquivalentKeyPressed(e)) return;

    if (isOSREnabled) {
      handleJetBrainsOSRMetaKeyIssues(e, editor);
    } else if (!isJetBrains()) {
      await handleVSCMetaKeyIssues(e, editor);
    }
  };

  const handleKeyUp = () => {
    setActiveKey(null);
  };

  const onEnterRef = useUpdatingRef(
    (modifiers: InputModifiers) => {
      if (isStreaming || isEditModeAndNoCodeToEdit) {
        return;
      }

      const json = editor.getJSON();

      // Don't do anything if input box is empty
      if (!json.content?.some((c) => c.content)) {
        return;
      }

      props.onEnter(json, modifiers, editor);

      if (props.isMainInput) {
        const content = editor.state.toJSON().doc;
        addRef.current(content);
      }
    },
    [props.onEnter, editor, props.isMainInput],
  );

  // Re-focus main input after done generating
  useEffect(() => {
    if (editor && !isStreaming && props.isMainInput && document.hasFocus()) {
      editor.commands.focus(undefined, { scrollIntoView: false });
    }
  }, [props.isMainInput, isStreaming, editor]);

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

      dispatch(clearCodeToEdit());

      if (historyLength > 0) {
        await saveSession();
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
      await saveSession();
      setTimeout(() => {
        editor?.commands.focus("end");
      }, 20);
    },
    [editor, props.isMainInput, saveSession],
  );

  useWebviewListener(
    "highlightedCode",
    async (data) => {
      if (!props.isMainInput || !editor) {
        return;
      }

      const rif: RangeInFile & { contents: string } =
        data.rangeInFileWithContents;
      const basename = getBasename(rif.filepath);
      const relativePath = getRelativePath(
        rif.filepath,
        await ideMessenger.ide.getWorkspaceDirs(),
      );
      const rangeStr = `(${rif.range.start.line + 1}-${
        rif.range.end.line + 1
      })`;

      const itemName = `${basename} ${rangeStr}`;
      const item: ContextItemWithId = {
        content: rif.contents,
        name: itemName,
        // Description is passed on to the LLM to give more context on file path
        description: `${relativePath} ${rangeStr}`,
        id: {
          providerTitle: "code",
          itemId: v4(),
        },
        uri: {
          type: "file",
          value: rif.filepath,
        },
      };

      let index = 0;
      for (const el of editor.getJSON().content) {
        if (el.attrs?.item?.name === itemName) {
          return; // Prevent duplicate code blocks
        }
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

      if (data.prompt) {
        editor.commands.focus("end");
        editor.commands.insertContent(data.prompt);
      }

      if (data.shouldRun) {
        onEnterRef.current({ useCodebase: false, noContext: true });
      }

      setTimeout(() => {
        editor.commands.blur();
        editor.commands.focus("end");
      }, 20);
    },
    [
      editor,
      props.isMainInput,
      historyLength,
      props.isMainInput,
      onEnterRef.current,
    ],
  );

  useWebviewListener(
    "focusEdit",
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
    "focusEditWithoutClear",
    async () => {
      if (!props.isMainInput) {
        return;
      }

      setTimeout(() => {
        editor?.commands.focus("end");
      }, 2000);
    },
    [editor, props.isMainInput],
  );

  useWebviewListener(
    "isContinueInputFocused",
    async () => {
      return props.isMainInput && editorFocusedRef.current;
    },
    [editorFocusedRef, props.isMainInput],
    !props.isMainInput,
  );

  useWebviewListener(
    "focusContinueSessionId",
    async (data) => {
      if (!props.isMainInput) {
        return;
      }
      loadSession(data.sessionId);
    },
    [loadSession, props.isMainInput],
  );

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

  const [activeKey, setActiveKey] = useState<string | null>(null);

  const insertCharacterWithWhitespace = useCallback(
    (char: string) => {
      const text = editor.getText();
      if (!text.endsWith(char)) {
        if (text.length > 0 && !text.endsWith(" ")) {
          editor.commands.insertContent(` ${char}`);
        } else {
          editor.commands.insertContent(char);
        }
      }
    },
    [editor],
  );

  return (
    <InputBoxDiv
      border={props.border}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
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
            defaultModel.capabilities,
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
      <PaddingDiv>
        <EditorContent
          spellCheck={false}
          editor={editor}
          onClick={(event) => {
            event.stopPropagation();
          }}
        />
        <InputToolbar
          toolbarOptions={props.toolbarOptions}
          activeKey={activeKey}
          hidden={shouldHideToolbar && !props.isMainInput}
          onAddContextItem={() => insertCharacterWithWhitespace("@")}
          onAddSlashCommand={() => insertCharacterWithWhitespace("/")}
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
          disabled={isStreaming}
        />
      </PaddingDiv>

      {showDragOverMsg &&
        modelSupportsImages(
          defaultModel.provider,
          defaultModel.model,
          defaultModel.title,
          defaultModel.capabilities,
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
