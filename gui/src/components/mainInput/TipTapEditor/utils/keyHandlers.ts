import { Editor } from "@tiptap/react";
import { KeyboardEvent, useRef } from "react";
import { isJetBrains, isMetaEquivalentKeyPressed } from "../../../../util";
import {
  handleJetBrainsOSRMetaKeyIssues,
  handleVSCMetaKeyIssues,
} from "../../util/handleMetaKeyIssues";

export function useEditorEventHandlers(options: {
  editor: Editor | null;
  isOSREnabled: boolean;
  editorFocusedRef: React.MutableRefObject<boolean | undefined>;
  setActiveKey: (key: string | null) => void;
}) {
  const { editor, isOSREnabled, editorFocusedRef, setActiveKey } = options;
  const metaActiveRef = useRef(false);

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

    if (!editorFocusedRef?.current || !isMetaEquivalentKeyPressed(e)) return;

    // Only set activeKey for Meta/Control/Alt to drive toolbar highlighting
    if (e.key === "Meta" || e.key === "Control" || e.key === "Alt") {
      setActiveKey(e.key);
      metaActiveRef.current = true;
    }

    if (isOSREnabled) {
      handleJetBrainsOSRMetaKeyIssues(e, editor);
    } else if (!isJetBrains()) {
      await handleVSCMetaKeyIssues(e, editor);
    }
  };

  const handleKeyUp = () => {
    if (metaActiveRef.current) {
      setActiveKey(null);
      metaActiveRef.current = false;
    }
  };

  return { handleKeyDown, handleKeyUp };
}
