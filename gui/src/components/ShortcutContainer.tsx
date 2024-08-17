import { useContext, useRef, useState, useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";
import { IdeMessengerContext } from "../context/IdeMessenger";

// Check if the platform is macOS or Windows
const platform = navigator.userAgent.toLowerCase();
const isMac = platform.includes("mac");
const shortcutsBarFontSize = '10px'

type ShortcutProps = {
  modifiers: string[];
  keyCode: string;
  description: string;
  onClick?: () => void;
};


const Shortcut = ({
  modifiers,
  keyCode,
  description,
  onClick,
}: ShortcutProps) => {
  const modifierString = modifiers.join(" + ");
  return (
    <div
      className="flex gap-1 items-center text-sm text-slate-400 rounded-lg px-1 cursor-pointer select-none m-0 mx-[2px] border-solid shortcut-border border-[1px]"
      onClick={onClick}
    >
      <span className={`text-[${shortcutsBarFontSize}]`}>{description}</span>
      <div
        className="monaco-keybinding "
        aria-label={`${modifierString}+${keyCode}`}
      >
        {modifiers.map((mod, index) => (
          <span className="monaco-keybinding-key" style={{fontSize: shortcutsBarFontSize}} key={index}>
            {mod}
          </span>
        ))}
        <span className="monaco-keybinding-key" style={{fontSize: shortcutsBarFontSize}}>{keyCode}</span>
      </div>
    </div>
  );
};

// Styled components for arrow buttons
const ArrowButton = styled.button`
  border: none;
  background: none;
  color: #949490;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  transition: color 0.3s;

  svg {
    width: 0.7rem;
    height: 0.7rem;
  }

  &:hover {
    color: #000;
  }
`;

const LeftArrowButton = styled(ArrowButton)`
  left: 0;
`;

const RightArrowButton = styled(ArrowButton)`
  right: 0;
`;

const ShortcutContainer = () => {
  const ideMessenger = useContext(IdeMessengerContext);
  const shortcutContainerRef = useRef<HTMLDivElement>(null);
  const [modifier] = useState(isMac ? "Cmd" : "Ctrl");

  useEffect(() => {
    const shortcutContainer = shortcutContainerRef.current;
    if (shortcutContainer) {
      const handleWheel = (event: WheelEvent) => {
        if (event.deltaY !== 0) {
          event.preventDefault();
          shortcutContainer.scrollLeft += event.deltaY;
        }
      };
      shortcutContainer.addEventListener("wheel", handleWheel);
      return () => {
        shortcutContainer.removeEventListener("wheel", handleWheel);
      };
    }
  }, []);

  const scrollLeft = () => {
    if (shortcutContainerRef.current) {
      shortcutContainerRef.current.scrollBy({ left: -200, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (shortcutContainerRef.current) {
      shortcutContainerRef.current.scrollBy({ left: 200, behavior: "smooth" });
    }
  };

  const shortcuts = [
    { modifiers: [modifier], keyCode: '[', description: 'Big', onClick: () => ideMessenger.post('bigChat', undefined) },
    { modifiers: [modifier], keyCode: '0', description: 'Prev', onClick: () => ideMessenger.post('lastChat', undefined) },
    { modifiers: [modifier], keyCode: 'O', description: 'History', onClick: () => ideMessenger.post('openHistory', undefined) },
    { modifiers: [modifier], keyCode: ';', description: 'Close', onClick: () => ideMessenger.post('closeChat', undefined) },
    { modifiers: [modifier, 'Shift'], keyCode: 'L', description: 'Append Selected', onClick: () => ideMessenger.post('appendSelected', undefined) },
  ];

  return (
    <div className="relative h-[1.55rem] overflow-hidden flex justify-center w-full">
      <LeftArrowButton onClick={scrollLeft}>
        <ChevronLeftIcon />
      </LeftArrowButton>

      <div
        ref={shortcutContainerRef}
        className="flex overflow-x-auto whitespace-nowrap no-scrollbar h-full mx-3 max-w-screen-lg"
      >
        {shortcuts.map((shortcut, index) => (
          <Shortcut
            key={`${shortcut.keyCode}-${index}`}
            modifiers={shortcut.modifiers}
            keyCode={shortcut.keyCode}
            description={shortcut.description}
            onClick={shortcut.onClick}
          />
        ))}
      </div>

      <RightArrowButton onClick={scrollRight}>
        <ChevronRightIcon />
      </RightArrowButton>
    </div>
  );
};

export default ShortcutContainer;
