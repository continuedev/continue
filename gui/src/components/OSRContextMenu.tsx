import React, { useContext, useEffect, useState } from "react";
import useIsOSREnabled from "../hooks/useIsOSREnabled";
import { IdeMessengerContext } from "../context/IdeMessenger";

const OSRContextMenu = () => {
  const ideMessenger = useContext(IdeMessengerContext);

  const [position, setPosition] = useState<{
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
  } | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const isOSREnabled = useIsOSREnabled();
  useEffect(() => {
    function leaveWindowHandler(event: MouseEvent) {
      setPosition(null);
    }
    function contextMenuHandler(event: MouseEvent) {
      event.preventDefault();
    }
    function rightClickHandler(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setPosition(null);
      }
      if (event.button === 2) {
        event.preventDefault();

        // always open towards inside of window from click
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

    if (isOSREnabled) {
      document.addEventListener("mouseleave", leaveWindowHandler);
      document.addEventListener("contextmenu", contextMenuHandler);
      document.addEventListener("mousedown", rightClickHandler);
    }

    return () => {
      document.removeEventListener("mouseleave", leaveWindowHandler);
      document.removeEventListener("contextmenu", contextMenuHandler);
      document.removeEventListener("mousedown", rightClickHandler);
    };
  }, [isOSREnabled, menuRef]);

  if (!position) {
    return null;
  }
  return (
    <div
      className="bg-vsc-editor-background absolute overflow-hidden rounded-md border border-solid border-gray-500"
      style={{
        ...position,
        zIndex: 1000,
      }}
      ref={menuRef}
    >
      <div
        className="cursor-pointer px-2 py-1 hover:opacity-90"
        onClick={(e) => {
          e.stopPropagation();
          ideMessenger.post("toggleDevTools", undefined);
        }}
      >
        Toggle Dev Tools
      </div>
    </div>
  );
};

export default OSRContextMenu;
