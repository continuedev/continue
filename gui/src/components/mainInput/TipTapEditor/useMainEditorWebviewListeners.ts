import { Editor } from "@tiptap/react";
import { InputModifiers } from "core";
import { rifWithContentsToContextItem } from "core/commands/util";
import { MutableRefObject } from "react";
import { useWebviewListener } from "../../../hooks/useWebviewListener";
import { useAppSelector } from "../../../redux/hooks";
import { clearCodeToEdit } from "../../../redux/slices/editState";
import { setNewestToolbarPreviewForInput } from "../../../redux/slices/sessionSlice";
import { AppDispatch } from "../../../redux/store";
import { loadSession, saveCurrentSession } from "../../../redux/thunks/session";
import { CodeBlock, PromptBlock } from "./extensions";
import { insertCurrentFileContextMention } from "./utils/insertCurrentFileContextMention";

/**
 * Hook for setting up main editor specific webview listeners
 */
export function useMainEditorWebviewListeners({
  editor,
  onEnterRef,
  dispatch,
  historyLength,
  inputId,
  editorFocusedRef,
}: {
  editor: Editor | null;
  onEnterRef: MutableRefObject<(modifiers: InputModifiers) => void>;
  dispatch: AppDispatch;
  historyLength: number;
  inputId: string;
  editorFocusedRef: MutableRefObject<boolean | undefined>;
}) {
  const activeContextProviders = useAppSelector(
    (state) => state.config.config.contextProviders,
  );
  const useCurrentFileAsContext = useAppSelector(
    (state) => state.config.config.experimental?.useCurrentFileAsContext,
  );
  const isInEdit = useAppSelector((state) => state.session.isInEdit);

  useWebviewListener(
    "isContinueInputFocused",
    async () => {
      return !!editorFocusedRef.current;
    },
    [editorFocusedRef],
  );

  useWebviewListener(
    "userInput",
    async (data) => {
      if (!editor) return;
      editor.commands.insertContent(data.input);
      onEnterRef.current({ useCodebase: false, noContext: true });
    },
    [editor, onEnterRef.current],
  );

  useWebviewListener("jetbrains/editorInsetRefresh", async () => {
    editor?.chain().clearContent().focus().run();
  });

  useWebviewListener(
    "focusContinueInput",
    async () => {
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
    [historyLength, editor, dispatch],
  );

  useWebviewListener(
    "focusContinueInputWithoutClear",
    async () => {
      setTimeout(() => {
        editor?.commands.focus("end");
      }, 20);
    },
    [editor],
  );

  useWebviewListener(
    "focusContinueInputWithNewSession",
    async () => {
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
    [editor, dispatch],
  );

  useWebviewListener(
    "highlightedCode",
    async (data) => {
      if (!editor) return;

      const contextItem = rifWithContentsToContextItem(
        data.rangeInFileWithContents,
      );

      let index = 0;
      for (const el of editor.getJSON()?.content ?? []) {
        // Prevent exact duplicate code blocks
        if (el.attrs?.item?.name === contextItem.name) {
          return;
        }

        if (el.type === CodeBlock.name || el.type === PromptBlock.name) {
          index += 2;
        } else {
          break;
        }
      }

      editor
        .chain()
        .insertContentAt(index, {
          type: CodeBlock.name,
          attrs: {
            item: contextItem,
            inputId,
          },
        })
        .run();

      dispatch(
        setNewestToolbarPreviewForInput({
          inputId,
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
    [editor, inputId, onEnterRef.current],
  );

  useWebviewListener(
    "isContinueInputFocused",
    async () => {
      return !!editorFocusedRef.current;
    },
    [editorFocusedRef],
  );

  useWebviewListener(
    "focusContinueSessionId",
    async (data) => {
      if (!data.sessionId) return;

      await dispatch(
        loadSession({
          sessionId: data.sessionId,
          saveCurrentSession: true,
        }),
      );
    },
    [],
  );

  useWebviewListener(
    "newSession",
    async () => {
      // do not insert current file context mention if we are in edit mode or if addFileContext is disabled
      if (!editor || isInEdit || !useCurrentFileAsContext) return;
      insertCurrentFileContextMention(editor, activeContextProviders);
    },
    [editor, activeContextProviders, isInEdit, useCurrentFileAsContext],
  );

  useWebviewListener(
    "addToChat",
    async (data) => {
      if (!editor) return;
      let chain = editor.chain();

      for (let mention of data.data) {
        chain
          .insertContent({
            type: "mention",
            attrs: {
              id: mention.fullPath,
              query: mention.fullPath,
              itemType: mention.type,
              label: mention.name,
            },
          })
          .insertContent(" ");
      }

      chain.run();
    },
    [editor],
  );
}
