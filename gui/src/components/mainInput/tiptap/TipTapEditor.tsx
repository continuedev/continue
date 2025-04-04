import { Editor, EditorContent, JSONContent } from "@tiptap/react";
import { ContextProviderDescription, InputModifiers } from "core";
import { modelSupportsImages } from "core/llm/autodetect";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import useIsOSREnabled from "../../../hooks/useIsOSREnabled";
import useUpdatingRef from "../../../hooks/useUpdatingRef";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectDefaultModel } from "../../../redux/slices/configSlice";
import {
  selectIsInEditMode,
  setMainEditorContentTrigger,
} from "../../../redux/slices/sessionSlice";
import InputToolbar, { ToolbarOptions } from "../InputToolbar";
import { ComboBoxItem } from "../types";
import { DragOverlay } from "./DragOverlay";
import { createEditorConfig, getPlaceholderText } from "./editorConfig";
import { handleImageFile } from "./imageUtils";
import { useEditorEventHandlers } from "./keyHandlers";
import { InputBoxDiv } from "./StyledComponents";
import "./TipTapEditor.css";
import { useWebviewListeners } from "./useWebviewListeners";

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

  const [shouldHideToolbar, setShouldHideToolbar] = useState(true);

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
    if (isInEditMode) {
      setShouldHideToolbar(false);
    }
    if (props.isMainInput) {
      editor?.commands.clearContent(true);
    }
  }, [editor, isInEditMode, props.isMainInput]);

  const editorFocusedRef = useUpdatingRef(editor?.isFocused, [editor]);

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
  useWebviewListeners({
    editor,
    onEnterRef,
    dispatch,
    historyLength,
    props,
    editorFocusedRef,
  });

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

  const { handleKeyUp, handleKeyDown } = useEditorEventHandlers({
    editor,
    isOSREnabled: isOSREnabled,
    editorFocusedRef,
    isInEditMode,
    setActiveKey,
  });

  const blurTimeout = useRef<NodeJS.Timeout | null>(null);
  const cancelBlurTimeout = useCallback(() => {
    if (blurTimeout.current) {
      clearTimeout(blurTimeout.current);
      blurTimeout.current = null;
    }
  }, [blurTimeout]);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (isInEditMode) {
        return;
      }
      // Check if the new focus target is within our InputBoxDiv
      const currentTarget = e.currentTarget;
      const relatedTarget = e.relatedTarget as Node | null;

      if (relatedTarget && currentTarget?.contains(relatedTarget)) {
        return;
      }
      // Otherwise give e.g. listboxes a chance to cancel the hiding
      blurTimeout.current = setTimeout(() => {
        setShouldHideToolbar(true);
      }, 100);
    },
    [isInEditMode, blurTimeout],
  );

  const handleFocus = useCallback(() => {
    cancelBlurTimeout();
    setShouldHideToolbar(false);
  }, [cancelBlurTimeout]);

  // TODO pass clear blur timeout to model and mode selectors
  // Seems like unnecessary for now?

  return (
    <InputBoxDiv
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      className={shouldHideToolbar ? "cursor-default" : "cursor-text"}
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
