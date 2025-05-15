import { Editor, JSONContent } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import History from "@tiptap/extension-history";
import Image from "@tiptap/extension-image";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import { Plugin } from "@tiptap/pm/state";
import { useEditor } from "@tiptap/react";
import { InputModifiers } from "core";
import { modelSupportsImages } from "core/llm/autodetect";
import { usePostHog } from "posthog-js/react";
import { useRef } from "react";
import {
  getContextProviderDropdownOptions,
  getSlashCommandDropdownOptions,
} from ".";
import { IIdeMessenger } from "../../../../context/IdeMessenger";
import { useSubmenuContextProviders } from "../../../../context/SubmenuContextProviders";
import { useInputHistory } from "../../../../hooks/useInputHistory";
import useUpdatingRef from "../../../../hooks/useUpdatingRef";
import { useAppSelector } from "../../../../redux/hooks";
import { selectUseActiveFile } from "../../../../redux/selectors";
import { selectSelectedChatModel } from "../../../../redux/slices/configSlice";
import { AppDispatch } from "../../../../redux/store";
import { exitEditMode } from "../../../../redux/thunks/editMode";
import { getFontSize, isJetBrains } from "../../../../util";
import * as ContinueExtensions from "../extensions";
import { TipTapEditorProps } from "../TipTapEditor";
import { handleImageFile } from "./imageUtils";

export function getPlaceholderText(
  placeholder: TipTapEditorProps["placeholder"],
  historyLength: number,
) {
  if (placeholder) {
    return placeholder;
  }

  return historyLength === 0
    ? "Ask anything, '/' for prompts, '@' to add context"
    : "Ask a follow-up";
}

/**
 * Checks if the editor content is valid for submission.
 * A valid submission can contain either text content or prompt/code blocks
 *
 * @param json The editor JSON content
 * @returns true if the content is valid for submission, false otherwise
 */
export function hasValidEditorContent(json: JSONContent): boolean {
  // Check for prompt or code blocks
  const hasPromptOrCodeBlock = json.content?.some(
    (c) =>
      c.type === ContinueExtensions.PromptBlock.name ||
      c.type === ContinueExtensions.CodeBlock.name,
  );

  // Check for text content
  const hasTextContent = json.content?.some((c) => c.content);

  // Content is valid if it has either text or special blocks
  return hasTextContent || hasPromptOrCodeBlock || false;
}

/**
 * This function is called only once, so we need to use refs to pass in the latest values
 */
export function createEditorConfig(options: {
  props: TipTapEditorProps;
  ideMessenger: IIdeMessenger;
  dispatch: AppDispatch;
}) {
  const { props, ideMessenger, dispatch } = options;

  const posthog = usePostHog();

  const { getSubmenuContextItems } = useSubmenuContextProviders();
  const defaultModel = useAppSelector(selectSelectedChatModel);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const useActiveFile = useAppSelector(selectUseActiveFile);
  const historyLength = useAppSelector((store) => store.session.history.length);
  const mode = useAppSelector((store) => store.session.mode);
  const modeRef = useUpdatingRef(mode);
  const codeToEdit = useAppSelector((store) => store.editModeState.codeToEdit);

  const inSubmenuRef = useRef<string | undefined>(undefined);
  const inDropdownRef = useRef(false);
  const defaultModelRef = useUpdatingRef(defaultModel);
  const isStreamingRef = useUpdatingRef(isStreaming);
  const getSubmenuContextItemsRef = useUpdatingRef(getSubmenuContextItems);
  const availableContextProvidersRef = useUpdatingRef(
    props.availableContextProviders,
  );
  const historyLengthRef = useUpdatingRef(historyLength);
  const availableSlashCommandsRef = useUpdatingRef(
    props.availableSlashCommands,
  );
  const { prevRef, nextRef, addRef } = useInputHistory(props.historyKey);

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

  const editor: Editor | null = useEditor({
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
                        handleImageFile(ideMessenger, file).then((resp) => {
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
      }).configure({
        HTMLAttributes: {
          class: "object-contain max-h-[210px] max-w-full mx-1",
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
                noContext: !!useActiveFile,
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
              return false;
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
              return false;
            },
            Escape: () => {
              if (inDropdownRef.current) {
                return false;
              }
              // In JetBrains, this is how we close the sidebar when the input box is focused
              if (isJetBrains()) {
                ideMessenger.post("closeSidebar", undefined);
                return true;
              }

              if (modeRef.current === "edit") {
                dispatch(
                  exitEditMode({
                    openNewSession: false,
                  }),
                );
              }
              ideMessenger.post("focusEditor", undefined);

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
              return false;
            },
          };
        },
      }).configure({
        HTMLAttributes: {
          class: "my-1",
        },
      }),
      Text,
      ContinueExtensions.Mention.configure({
        suggestion: getContextProviderDropdownOptions(
          availableContextProvidersRef,
          getSubmenuContextItemsRef,
          enterSubmenu,
          onClose,
          onOpen,
          inSubmenuRef,
          ideMessenger,
        ),
      }),
      ContinueExtensions.SlashCommand.configure({
        suggestion: getSlashCommandDropdownOptions(
          availableSlashCommandsRef,
          onClose,
          onOpen,
          ideMessenger,
          dispatch,
          props.inputId,
        ),
      }),
      ContinueExtensions.PromptBlock,
      ContinueExtensions.CodeBlock,
    ],
    editorProps: {
      attributes: {
        class: "outline-none overflow-hidden",
        style: `font-size: ${getFontSize()}px;`,
      },
    },
    content: props.editorState,
    editable: !isStreaming || props.isMainInput,
  });

  const onEnterRef = useUpdatingRef(
    (modifiers: InputModifiers) => {
      if (!editor) {
        return;
      }
      if (isStreaming || (codeToEdit.length === 0 && mode === "edit")) {
        return;
      }

      const json = editor.getJSON();

      // Don't do anything if input box doesn't have valid content
      if (!hasValidEditorContent(json)) {
        return;
      }

      if (props.isMainInput) {
        addRef.current(json);
      }

      props.onEnter(json, modifiers, editor);
    },
    [props.onEnter, editor, props.isMainInput, codeToEdit, mode],
  );

  return { editor, onEnterRef };
}
