// shortcutContainer.tsx
import { useContext, useRef, useState, useEffect } from 'react';
import { IdeMessengerContext } from "../context/IdeMessenger";

// check mac or window
const platform = navigator.userAgent.toLowerCase();
const isMac = platform.includes('mac');
const isWindows = platform.includes('win');

type ShortcutProps = {
  modifiers: string[];
  keyCode: string;
  description: string;
  onClick?: () => void;
};

const Shortcut = ({ modifiers, keyCode, description, onClick }: ShortcutProps) => {
  const modifierString = modifiers.join(' + ');
  return (
    <div
      className='flex gap-1 items-center text-sm text-slate-400 rounded-lg px-1 cursor-pointer select-none m-0 mx-[2px] border-solid shortcut-border border-[1px]'
      onClick={onClick}
    >
      <span className='text-[12px]'>{description}</span>
      <div className='monaco-keybinding' aria-label={`${modifierString}+${keyCode}`}>
        {modifiers.map((mod, index) => (
          <span className='monaco-keybinding-key' key={index}>
            {mod}
          </span>
        ))}
        <span className='monaco-keybinding-key'>{keyCode}</span>
      </div>
    </div>
  );
};

const ShortcutContainer = () => {
  const ideMessenger = useContext(IdeMessengerContext);
  const shortcutContainerRef = useRef<HTMLDivElement>(null);
  const [modifier] = useState(isMac ? 'Cmd' : 'Ctrl');

  useEffect(() => {
    const shortcutContainer = shortcutContainerRef.current;
    if (shortcutContainer) {
      const handleWheel = (event: WheelEvent) => {
        if (event.deltaY !== 0) {
          event.preventDefault();
          shortcutContainer.scrollLeft += event.deltaY;
        }
      };
      shortcutContainer.addEventListener('wheel', handleWheel);
      return () => {
        shortcutContainer.removeEventListener('wheel', handleWheel);
      };
    }
  }, []);

  const shortcuts = [
    { modifiers: [modifier], keyCode: '[', description: 'Big', onClick: () => ideMessenger.post('bigChat', undefined) },
    { modifiers: [modifier], keyCode: '0', description: 'Prev', onClick: () => ideMessenger.post('lastChat', undefined) },
    { modifiers: [modifier], keyCode: 'O', description: 'History', onClick: () => ideMessenger.post('openHistory', undefined) },
    { modifiers: [modifier], keyCode: ';', description: 'Close', onClick: () => ideMessenger.post('closeChat', undefined) },
    { modifiers: [modifier, 'Shift'], keyCode: 'L', description: 'Append Selected', onClick: () => ideMessenger.post('appendSelected', undefined) },
  ];
  return (
    <div ref={shortcutContainerRef} className='flex overflow-x-auto whitespace-nowrap no-scrollbar h-[1.55rem]'>
      {shortcuts.map((shortcut, index) => (
        <Shortcut
          key={`${shortcut.keyCode}-${index}`}
          modifiers={shortcut.modifiers}
          keyCode={shortcut.keyCode}
          description={shortcut.description}
          onClick={shortcut.onClick} // Pass onClick handler
        />
      ))}
    </div>
  );
};

export default ShortcutContainer;
