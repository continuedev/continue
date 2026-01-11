import React, { useContext, useEffect, useRef, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import useIsOSREnabled from "../hooks/useIsOSREnabled";
import { getPlatform } from "../util";

interface Position {
  top?: number;
  left?: number;
  bottom?: number;
  right?: number;
}

const OSRContextMenu = () => {
  const ideMessenger = useContext(IdeMessengerContext);
  const isOSREnabled = useIsOSREnabled();
  const platform = useRef(getPlatform());

  const [position, setPosition] = useState<Position | null>(null);
  const [canCopy, setCanCopy] = useState(false);
  const [canCut, setCanCut] = useState(false);
  const [canPaste, setCanPaste] = useState(false);
  const [ruleContext, setRuleContext] = useState<{
    baseFilename: string;
    isGlobal: boolean;
  } | null>(null);

  const menuRef = React.useRef<HTMLDivElement>(null);
  const selectedTextRef = useRef<string | null>(null);
  const selectedRangeRef = useRef<Range | null>(null);

  function onMenuItemClick(
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) {
    event.preventDefault();

    // restore selection
    if (selectedRangeRef.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectedRangeRef.current);
    }

    // Hide menu
    setPosition(null);
    setRuleContext(null);
  }

  function handleEditRule() {
    if (!ruleContext) return;
    if (ruleContext.isGlobal) {
      ideMessenger.post("config/openProfile", { profileId: undefined });
    } else {
      ideMessenger.post("config/openProfile", { profileId: undefined });
    }
    setPosition(null);
    setRuleContext(null);
  }

  function handleDeleteRule() {
    if (!ruleContext) return;
    if (ruleContext.isGlobal) {
      ideMessenger.post("config/deleteGlobalRule", {
        baseFilename: ruleContext.baseFilename,
      });
    } else {
      ideMessenger.post("config/deleteLocalWorkspaceBlock", {
        blockType: "rules",
        baseFilename: ruleContext.baseFilename,
      });
    }
    setPosition(null);
    setRuleContext(null);
  }

  useEffect(() => {
    function leaveWindowHandler() {
      setPosition(null);
      setRuleContext(null);
    }
    function contextMenuHandler(event: MouseEvent) {
      if (event.shiftKey) return;
      event.preventDefault();
    }
    function clickHandler(event: MouseEvent) {
      // If clicked outside of menu, close menu
      if (!menuRef.current?.contains(event.target as Node)) {
        setPosition(null);
        setRuleContext(null);
      }

      if (event.button === 2) {
        if (event.shiftKey) return;

        // Prevent default context menu
        event.preventDefault();

        setRuleContext(null);
        selectedRangeRef.current = null;
        selectedTextRef.current = null;

        const selection = window.getSelection();
        let isClickWithinSelection = false;
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();
          selectedRangeRef.current = range.cloneRange();

          if (selectedText.length > 0) {
            if (selectedText) {
              selectedTextRef.current = selectedText;
              const rects = range.getClientRects();
              for (let i = 0; i < rects.length; i++) {
                const rect = rects[i];
                if (
                  event.clientX >= rect.left &&
                  event.clientX <= rect.right &&
                  event.clientY >= rect.top &&
                  event.clientY <= rect.bottom
                ) {
                  isClickWithinSelection = true;
                  break;
                }
              }
            }
          }
        }

        // Check if right clicked on editable content (allows paste/cut)
        let isEditable = false;
        if (
          event.target &&
          (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement ||
            (event.target instanceof HTMLElement &&
              event.target.isContentEditable))
        ) {
          isEditable =
            "isContentEditable" in event.target &&
            event.target.isContentEditable
              ? true
              : !(
                  (event.target as any).readOnly ||
                  (event.target as any).disabled
                );
        }

        setCanCopy(!!selectedTextRef.current && isClickWithinSelection);
        setCanCut(
          !!(isEditable && selectedTextRef.current && isClickWithinSelection),
        );

        // only can paste if editable
        setCanPaste(isEditable);

        // Open towards inside of window from click
        const toRight = event.clientX > window.innerWidth / 2;
        const toBottom = event.clientY > window.innerHeight / 2;
        if (toRight) {
          if (toBottom) {
            setPosition({
              bottom: window.innerHeight - event.clientY,
              right: window.innerWidth - event.clientX,
            });
          } else {
            setPosition({
              top: event.clientY,
              right: window.innerWidth - event.clientX,
            });
          }
        } else {
          if (toBottom) {
            setPosition({
              bottom: window.innerHeight - event.clientY,
              left: event.clientX,
            });
          } else {
            setPosition({
              top: event.clientY,
              left: event.clientX,
            });
          }
        }
      }

      // Check for rule context menu
      let target = event.target as HTMLElement;
      while (target && target !== document.body) {
        if (target.getAttribute("data-context-menu-type") === "rule") {
          const baseFilename = target.getAttribute("data-rule-filename");
          const isGlobal = target.getAttribute("data-rule-global") === "true";
          if (baseFilename) {
            setRuleContext({ baseFilename, isGlobal });
            // Set position similar to above
            const toRight = event.clientX > window.innerWidth / 2;
            const toBottom = event.clientY > window.innerHeight / 2;
            if (toRight) {
              if (toBottom) {
                setPosition({
                  bottom: window.innerHeight - event.clientY,
                  right: window.innerWidth - event.clientX,
                });
              } else {
                setPosition({
                  top: event.clientY,
                  right: window.innerWidth - event.clientX,
                });
              }
            } else {
              if (toBottom) {
                setPosition({
                  bottom: window.innerHeight - event.clientY,
                  left: event.clientX,
                });
              } else {
                setPosition({
                  top: event.clientY,
                  left: event.clientX,
                });
              }
            }
          }
          break;
        }
        target = target.parentElement as HTMLElement;
      }
    }

    setPosition(null);
    document.addEventListener("mousedown", clickHandler);
    document.addEventListener("mouseleave", leaveWindowHandler);
    document.addEventListener("contextmenu", contextMenuHandler);

    return () => {
      document.removeEventListener("mousedown", clickHandler);
      document.removeEventListener("mouseleave", leaveWindowHandler);
      document.removeEventListener("contextmenu", contextMenuHandler);
    };
  }, [isOSREnabled]);

  if (!position) {
    return null;
  }
  return (
    <div
      className="bg-vsc-editor-background absolute flex flex-col gap-1.5 overflow-hidden rounded-md border border-solid border-gray-500 px-3 py-1.5"
      style={{
        ...position,
        zIndex: 9999,
      }}
      ref={menuRef}
    >
      {canCopy && (
        <div
          className="cursor-pointer hover:opacity-90"
          onClick={(e) => {
            onMenuItemClick(e);
            document.execCommand("copy");
          }}
        >
          Copy
        </div>
      )}
      {canCut && (
        <div
          className="cursor-pointer hover:opacity-90"
          onClick={(e) => {
            onMenuItemClick(e);
            document.execCommand("cut");
          }}
        >
          Cut
        </div>
      )}
      {canPaste && (
        <div
          className="cursor-pointer hover:opacity-90"
          onClick={async (e) => {
            onMenuItemClick(e);
            try {
              const text = await navigator.clipboard.readText();
              const activeElement = document.activeElement as HTMLElement;

              if (
                activeElement instanceof HTMLInputElement ||
                activeElement instanceof HTMLTextAreaElement
              ) {
                const start = activeElement.selectionStart || 0;
                const end = activeElement.selectionEnd || 0;
                activeElement.setRangeText(text, start, end, "end");
                activeElement.dispatchEvent(
                  new Event("input", { bubbles: true }),
                );
              } else if (activeElement.isContentEditable) {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  range.deleteContents();
                  const textNode = document.createTextNode(text);
                  range.insertNode(textNode);
                  // Move cursor to end of inserted text
                  range.setStartAfter(textNode);
                  range.setEndAfter(textNode);
                  selection.removeAllRanges();
                  selection.addRange(range);

                  activeElement.dispatchEvent(
                    new Event("input", { bubbles: true }),
                  );
                }
              }
            } catch (error) {
              console.error("Paste failed", error);
            }
          }}
        >
          Paste
        </div>
      )}
      <div
        className="cursor-pointer hover:opacity-90"
        onClick={(e) => {
          onMenuItemClick(e);
          // Check if we are inside a code block
          let target = selectedRangeRef.current?.startContainer?.parentElement;
          let codeBlock: HTMLElement | null = null;
          while (target && target !== document.body) {
            if (target.tagName === "PRE" || target.tagName === "CODE") {
              codeBlock = target;
              break;
            }
            target = target.parentElement;
          }

          if (codeBlock) {
            const range = document.createRange();
            range.selectNodeContents(codeBlock);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
          } else {
            document.execCommand("selectAll");
          }
        }}
      >
        Select All
      </div>
      {(canPaste || canCut) && (
        <>
          <div
            className="cursor-pointer hover:opacity-90"
            onClick={(e) => {
              onMenuItemClick(e);
              document.execCommand("undo");
            }}
          >
            Undo
          </div>
          <div
            className="cursor-pointer hover:opacity-90"
            onClick={(e) => {
              onMenuItemClick(e);
              document.execCommand("redo");
            }}
          >
            Redo
          </div>
        </>
      )}

      <hr className="my-1 border-gray-500" />
      <div
        className="cursor-pointer hover:opacity-90"
        onClick={(e) => {
          onMenuItemClick(e);
          ideMessenger.post("toggleDevTools", undefined);
        }}
      >
        Open Dev Tools
      </div>

      {ruleContext && (
        <>
          <hr className="my-1 border-gray-500" />
          <div
            className="cursor-pointer hover:opacity-90"
            onClick={(e) => {
              e.preventDefault();
              handleEditRule();
            }}
          >
            Edit Rule
          </div>
          <div
            className="cursor-pointer hover:opacity-90"
            onClick={(e) => {
              e.preventDefault();
              handleDeleteRule();
            }}
          >
            Delete Rule
          </div>
        </>
      )}
    </div>
  );
};

export default OSRContextMenu;
