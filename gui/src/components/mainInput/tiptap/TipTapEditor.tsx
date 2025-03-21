import { Editor, EditorContent, JSONContent } from "@tiptap/react";
import { ContextProviderDescription, InputModifiers } from "core";
import { rifWithContentsToContextItem } from "core/commands/util";
import { modelSupportsImages } from "core/llm/autodetect";
import { debounce } from "lodash";
import {
  KeyboardEvent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import useIsOSREnabled from "../../../hooks/useIsOSREnabled";
import useUpdatingRef from "../../../hooks/useUpdatingRef";
import { useWebviewListener } from "../../../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectDefaultModel } from "../../../redux/slices/configSlice";
import {
  clearCodeToEdit,
  selectIsInEditMode,
  setMainEditorContentTrigger,
  setNewestCodeblocksForInput,
} from "../../../redux/slices/sessionSlice";
import { loadSession, saveCurrentSession } from "../../../redux/thunks/session";
import { isJetBrains, isMetaEquivalentKeyPressed } from "../../../util";
import InputToolbar, { ToolbarOptions } from "../InputToolbar";
import { ComboBoxItem } from "../types";
import {
  handleJetBrainsOSRMetaKeyIssues,
  handleVSCMetaKeyIssues,
} from "../util/handleMetaKeyIssues";
import { DragOverlay } from "./DragOverlay";
import { createEditorConfig, getPlaceholderText } from "./editorConfig";
import { handleImageFile } from "./imageUtils";
import { InputBoxDiv } from "./StyledComponents";
import "./TipTapEditor.css";

export interface TipTapEditorProps {
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
  placeholder?: string;
  historyKey: string;
  inputId: string;
}

export const TIPPY_DIV_ID = "tippy-js-div";

function TipTapEditor(props: TipTapEditorProps) {
  const dispatch = useAppDispatch();

  const ideMessenger = useContext(IdeMessengerContext);

  const isOSREnabled = useIsOSREnabled();

  const defaultModel = useAppSelector(selectDefaultModel);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const isInEditMode = useAppSelector(selectIsInEditMode);
  const historyLength = useAppSelector((store) => store.session.history.length);

  const { editor, onEnterRef } = createEditorConfig({
    props,
    ideMessenger,
    dispatch,
  });

  const [shouldHideToolbar, setShouldHideToolbar] = useState(false);
  const debouncedShouldHideToolbar = debounce((value) => {
    setShouldHideToolbar(value);
  }, 200);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const placeholder = getPlaceholderText(props.placeholder, historyLength);

    editor.extensionManager.extensions.filter(
      (extension) => extension.name === "placeholder",
    )[0].options["placeholder"] = placeholder;

    editor.view.dispatch(editor.state.tr);
  }, [editor, props.placeholder, historyLength]);

  useEffect(() => {
    if (props.isMainInput) {
      editor?.commands.clearContent(true);
    }
  }, [editor, isInEditMode, props.isMainInput]);

  useEffect(() => {
    if (editor) {
      const handleFocus = () => {
        setShouldHideToolbar(false);
      };

      const handleBlur = () => {
        // TODO - make toolbar auto-hiding work without breaking tool dropdown focus
        // debouncedShouldHideToolbar(true);
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
    if (!editor) {
      return;
    }

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

  useEffect(() => {
    if (props.isMainInput) {
      /**
       * I have a strong suspicion that many of the other focus
       * commands are redundant, especially the ones inside
       * useTimeout.
       */
      editor?.commands.focus();
    }
  }, [props.isMainInput, editor]);

  // Re-focus main input after done generating
  useEffect(() => {
    if (editor && !isStreaming && props.isMainInput && document.hasFocus()) {
      editor.commands.focus(undefined, { scrollIntoView: false });
    }
  }, [props.isMainInput, isStreaming, editor]);

  // This allows anywhere in the app to set the content of the main input
  const mainInputContentTrigger = useAppSelector(
    (store) => store.session.mainEditorContentTrigger,
  );
  useEffect(() => {
    if (!props.isMainInput || !mainInputContentTrigger) {
      return;
    }
    queueMicrotask(() => {
      editor?.commands.setContent(mainInputContentTrigger);
    });
    dispatch(setMainEditorContentTrigger(undefined));
  }, [editor, props.isMainInput, mainInputContentTrigger]);

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
        await dispatch(
          saveCurrentSession({
            openNewSession: false,
            generateTitle: true,
          }),
        );
      }
      setTimeout(() => {
        editor?.commands.blur();
        editor?.commands.focus("end");
      }, 20);
    },
    [historyLength, editor, props.isMainInput],
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
      await dispatch(
        saveCurrentSession({
          openNewSession: true,
          generateTitle: true,
        }),
      );
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

      const contextItem = rifWithContentsToContextItem(
        data.rangeInFileWithContents,
      );

      let index = 0;
      for (const el of editor.getJSON()?.content ?? []) {
        if (el.attrs?.item?.name === contextItem.name) {
          return; // Prevent exact duplicate code blocks
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
            item: contextItem,
            inputId: props.inputId,
          },
        })
        .run();
      dispatch(
        setNewestCodeblocksForInput({
          inputId: props.inputId,
          contextItemId: contextItem.id.itemId,
        }),
      );
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
    [editor, props.isMainInput, historyLength, onEnterRef.current],
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
      return props.isMainInput && !!editorFocusedRef.current;
    },
    [editorFocusedRef, props.isMainInput],
    !props.isMainInput,
  );

  useWebviewListener(
    "focusContinueSessionId",
    async (data) => {
      if (!props.isMainInput || !data.sessionId) {
        return;
      }
      await dispatch(
        loadSession({
          sessionId: data.sessionId,
          saveCurrentSession: true,
        }),
      );
    },
    [props.isMainInput],
  );

  const [showDragOverMsg, setShowDragOverMsg] = useState(false);

  const [activeKey, setActiveKey] = useState<string | null>(null);

  const insertCharacterWithWhitespace = useCallback(
    (char: string) => {
      if (!editor) {
        return;
      }
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
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className="cursor-text"
      onClick={() => {
        editor?.commands.focus();
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
          !defaultModel ||
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
        handleImageFile(ideMessenger, file).then((result) => {
          if (!editor) {
            return;
          }
          if (result) {
            const [_, dataUrl] = result;
            const { schema } = editor.state;
            const node = schema.nodes.image.create({ src: dataUrl });
            const tr = editor.state.tr.insert(0, node);
            editor.view.dispatch(tr);
          }
        });
        event.preventDefault();
      }}
    >
      <div className="px-2.5 pb-1 pt-2">
        <EditorContent
          className={`scroll-container overflow-y-scroll ${props.isMainInput ? "max-h-[70vh]" : ""}`}
          spellCheck={false}
          editor={editor}
          onClick={(event) => {
            event.stopPropagation();
          }}
        />
        <InputToolbar
          isMainInput={props.isMainInput}
          toolbarOptions={props.toolbarOptions}
          activeKey={activeKey}
          hidden={shouldHideToolbar && !props.isMainInput}
          onAddContextItem={() => insertCharacterWithWhitespace("@")}
          onAddSlashCommand={() => insertCharacterWithWhitespace("/")}
          onEnter={onEnterRef.current}
          onImageFileSelected={(file) => {
            handleImageFile(ideMessenger, file).then((result) => {
              if (!editor) {
                return;
              }
              if (result) {
                const [_, dataUrl] = result;
                const { schema } = editor.state;
                const node = schema.nodes.image.create({ src: dataUrl });
                editor.commands.command(({ tr }) => {
                  tr.insert(0, node);
                  return true;
                });
              }
            });
          }}
          disabled={isStreaming}
        />
      </div>

      {showDragOverMsg &&
        modelSupportsImages(
          defaultModel?.provider || "",
          defaultModel?.model || "",
          defaultModel?.title,
          defaultModel?.capabilities,
        ) && (
          <DragOverlay show={showDragOverMsg} setShow={setShowDragOverMsg} />
        )}
      <div id={TIPPY_DIV_ID} className="fixed z-50" />
    </InputBoxDiv>
  );
}

export default TipTapEditor;
