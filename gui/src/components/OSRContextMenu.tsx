import React, { useContext, useEffect, useRef, useState } from "react";
import useIsOSREnabled from "../hooks/useIsOSREnabled";
import { IdeMessengerContext } from "../context/IdeMessenger";
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
  }

  useEffect(() => {
    function leaveWindowHandler() {
      setPosition(null);
    }
    function contextMenuHandler(event: MouseEvent) {
      event.preventDefault();
    }
    function clickHandler(event: MouseEvent) {
      // If clicked outside of menu, close menu
      if (!menuRef.current?.contains(event.target as Node)) {
        setPosition(null);
      }

      if (event.button === 2) {
        // Prevent default context menu
        event.preventDefault();

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
          "isContentEditable" in event.target &&
          typeof event.target.isContentEditable === "boolean"
        ) {
          isEditable = event.target.isContentEditable;
        }

        setCanCopy(!!selectedTextRef.current && isClickWithinSelection);
        setCanCut(
          !!(isEditable && selectedTextRef.current && isClickWithinSelection),
        );

        // TODO only can paste if there is text in clipboard?
        setCanPaste(isEditable);
        //   navigator.clipboard.readText().then((text) => {
        //     setCanPaste(text || null);
        //   });

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
    }

    setPosition(null);
    if (isOSREnabled && platform.current !== "mac") {
      document.addEventListener("mousedown", clickHandler);
      document.addEventListener("mouseleave", leaveWindowHandler);
      document.addEventListener("contextmenu", contextMenuHandler);
    }

    return () => {
      document.removeEventListener("mousedown", clickHandler);
      document.removeEventListener("mouseleave", leaveWindowHandler);
      document.removeEventListener("contextmenu", contextMenuHandler);
    };
  }, [isOSREnabled]);

  if (platform.current === "mac" || !isOSREnabled || !position) {
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
      {/* PASTING is currently broken, can't get the clipboard text */}
      {/* {canPaste && (
        <div
          className="cursor-pointer hover:opacity-90"
          onClick={async (e) => {
            onMenuItemClick(e);
            const clipboardText = await navigator.clipboard.readText();
            // const out = await navigator.clipboard.read();
            if (clipboardText) {
              selectedRangeRef.current?.deleteContents();
              selectedRangeRef.current?.insertNode(
                document.createTextNode(clipboardText),
              );
            }
          }}
        >
          Paste
        </div>
      )} */}
      <div
        className="cursor-pointer hover:opacity-90"
        onClick={(e) => {
          onMenuItemClick(e);
          ideMessenger.post("toggleDevTools", undefined);
        }}
      >
        Open Dev Tools
      </div>
    </div>
  );
};

export default OSRContextMenu;
