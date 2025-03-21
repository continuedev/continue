import { Editor } from "@tiptap/core";
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
import { IIdeMessenger } from "../../../context/IdeMessenger";
import { useSubmenuContextProviders } from "../../../context/SubmenuContextProviders";
import { useInputHistory } from "../../../hooks/useInputHistory";
import useUpdatingRef from "../../../hooks/useUpdatingRef";
import { useAppSelector } from "../../../redux/hooks";
import { selectUseActiveFile } from "../../../redux/selectors";
import { selectDefaultModel } from "../../../redux/slices/configSlice";
import {
  addCodeToEdit,
  selectHasCodeToEdit,
  selectIsInEditMode,
} from "../../../redux/slices/sessionSlice";
import { AppDispatch } from "../../../redux/store";
import { exitEditMode } from "../../../redux/thunks";
import { loadLastSession } from "../../../redux/thunks/session";
import { getFontSize } from "../../../util";
import { AddCodeToEdit } from "./extensions/AddCodeToEditExtension";
import { CodeBlockExtension } from "./extensions/CodeBlockExtension";
import { SlashCommand } from "./extensions/CommandsExtension";
import { MockExtension } from "./extensions/FillerExtension";
import { Mention } from "./extensions/MentionExtension";
import {
  getContextProviderDropdownOptions,
  getSlashCommandDropdownOptions,
} from "./getSuggestion";
import { handleImageFile } from "./imageUtils";
import { TipTapEditorProps } from "./TipTapEditor";

export function getPlaceholderText(
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

  // #region Selectors
  const { getSubmenuContextItems } = useSubmenuContextProviders();
  const defaultModel = useAppSelector(selectDefaultModel);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const useActiveFile = useAppSelector(selectUseActiveFile);
  const historyLength = useAppSelector((store) => store.session.history.length);
  const isInEditMode = useAppSelector(selectIsInEditMode);
  const hasCodeToEdit = useAppSelector(selectHasCodeToEdit);
  const isEditModeAndNoCodeToEdit = isInEditMode && !hasCodeToEdit;
  // #endregion

  // #region Refs
  const inSubmenuRef = useRef<string | undefined>(undefined);
  const inDropdownRef = useRef(false);
  const defaultModelRef = useUpdatingRef(defaultModel);
  const isStreamingRef = useUpdatingRef(isStreaming);
  const isInEditModeRef = useUpdatingRef(isInEditMode);
  const getSubmenuContextItemsRef = useUpdatingRef(getSubmenuContextItems);
  const availableContextProvidersRef = useUpdatingRef(
    props.availableContextProviders,
  );
  const historyLengthRef = useUpdatingRef(historyLength);
  const availableSlashCommandsRef = useUpdatingRef(
    props.availableSlashCommands,
  );
  const { prevRef, nextRef, addRef } = useInputHistory(props.historyKey);

  // #endregion

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
              if (inDropdownRef.current || !isInEditModeRef.current) {
                ideMessenger.post("focusEditor", undefined);
                return true;
              }
              (async () => {
                await dispatch(
                  loadLastSession({
                    saveCurrentSession: false,
                  }),
                );
                dispatch(exitEditMode());
              })();

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
        : MockExtension,
      CodeBlockExtension,
    ],
    editorProps: {
      attributes: {
        class: "outline-none -mt-1 overflow-hidden",
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
      if (isStreaming || isEditModeAndNoCodeToEdit) {
        return;
      }

      const json = editor.getJSON();

      // Don't do anything if input box is empty
      if (!json.content?.some((c) => c.content)) {
        return;
      }

      if (props.isMainInput) {
        addRef.current(json);
      }

      props.onEnter(json, modifiers, editor);
    },
    [props.onEnter, editor, props.isMainInput],
  );

  return { editor, onEnterRef };
}
