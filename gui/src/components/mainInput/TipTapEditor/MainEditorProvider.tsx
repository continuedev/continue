import { Editor } from "@tiptap/react";
import { InputModifiers } from "core";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setMainEditorContentTrigger } from "../../../redux/slices/sessionSlice";
import { useMainEditorWebviewListeners } from "./useMainEditorWebviewListeners";

/**
 * Context for accessing the main editor instance
 */
interface MainEditorContextType {
  /** The current main editor instance */
  mainEditor: Editor | null;
  /** Set the current main editor instance */
  setMainEditor: (editor: Editor | null) => void;
  /** The current input ID */
  inputId: string | null;
  /** Set the current input ID */
  setInputId: (id: string) => void;
  /** Reference to the execute content function */
  onEnterRef: React.MutableRefObject<(modifiers: InputModifiers) => void>;
}

const initialState: MainEditorContextType = {
  mainEditor: null,
  setMainEditor: () => {},
  inputId: null,
  setInputId: () => {},
  onEnterRef: { current: () => {} },
};

const MainEditorContext = createContext<MainEditorContextType>(initialState);

/**
 * Provider component that maintains a reference to the main editor
 */
export const MainEditorProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dispatch = useAppDispatch();
  const [mainEditor, setMainEditorInternal] = useState<Editor | null>(
    initialState.mainEditor,
  );
  const [inputId, setInputId] = useState<string | null>(initialState.inputId);
  const onEnterRef = useRef<(modifiers: InputModifiers) => void>(() => {});
  const editorFocusedRef = useRef<boolean>(false);
  const historyLength = useAppSelector((store) => store.session.history.length);

  // Listen for changes to mainEditorContentTrigger in Redux
  const mainEditorContentTrigger = useAppSelector(
    (store) => store.session.mainEditorContentTrigger,
  );

  useEffect(() => {
    if (mainEditor && mainEditorContentTrigger) {
      queueMicrotask(() => {
        mainEditor.commands.setContent(mainEditorContentTrigger);
      });
      // Clear the trigger after using it
      dispatch(setMainEditorContentTrigger(undefined));
    }
  }, [mainEditor, mainEditorContentTrigger, dispatch]);

  // Update focused ref when editor focus state changes
  useEffect(() => {
    if (mainEditor) {
      const updateFocus = () => {
        editorFocusedRef.current = mainEditor.isFocused || false;
      };

      mainEditor.on("focus", updateFocus);
      mainEditor.on("blur", updateFocus);

      return () => {
        mainEditor.off("focus", updateFocus);
        mainEditor.off("blur", updateFocus);
      };
    }
  }, [mainEditor]);

  // Set up main editor webview listeners when we have a valid editor and input ID
  useMainEditorWebviewListeners({
    editor: mainEditor,
    onEnterRef,
    dispatch,
    historyLength,
    inputId: inputId || "",
    editorFocusedRef,
  });

  const setMainEditor = (newEditor: Editor | null) => {
    setMainEditorInternal(newEditor);
  };

  const value: MainEditorContextType = {
    mainEditor,
    setMainEditor,
    inputId,
    setInputId,
    onEnterRef,
  };

  return (
    <MainEditorContext.Provider value={value}>
      {children}
    </MainEditorContext.Provider>
  );
};

/**
 * Hook to access the main editor context
 */
export const useMainEditor = (): MainEditorContextType =>
  useContext(MainEditorContext);
