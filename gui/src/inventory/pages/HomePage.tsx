import { useNavigate } from "react-router-dom";
import { useContext, useEffect } from "react";
import { getLogoPath } from "@/pages/welcome/setup/ImportExtensions";
import { getMetaKeyLabel } from "@/util";
import { IdeMessengerContext } from "@/context/IdeMessenger";

interface KbdProps {
  children: React.ReactNode;
}

export function Kbd({ children }: KbdProps) {
  return (
    <div className="inline-flex h-5 items-center justify-center rounded border-[0.5px] border-solid bg-background px-1.5 font-mono font-medium text-foreground">
      {children}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();

  const closeOverlay = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) {
      ideMessenger.post("closeOverlay", undefined);
    }
  }

  const menuItems = [
    {
      icon: "inventory.svg",
      label: "Inventory Settings",
      description: <>See all your AI tools</>,
      shortcut: <span className="flex gap-1"><Kbd>{getMetaKeyLabel()}</Kbd><Kbd>SHIFT</Kbd><Kbd>1</Kbd></span>,
      path: "/inventory",
    },
    {
      icon: "inventory-creator.svg",
      label: "Creator",
      description: <>Create new features</>,
      shortcut: <span className="flex gap-1"><Kbd>{getMetaKeyLabel()}</Kbd><Kbd>2</Kbd></span>,
      path: "/inventory/aiderMode",
    },
    {
      icon: "inventory-search.svg",
      label: "Search",
      description: <>AI web search</>,
      shortcut: <span className="flex gap-1"><Kbd>{getMetaKeyLabel()}</Kbd><Kbd>3</Kbd></span>,
      path: "/inventory/perplexityMode",
    },
  ];

  const updateOverlayStyle = (borderRadius: string, boxShadow: string) => {
    document.documentElement.style.setProperty('--overlay-border-radius', borderRadius);
    document.documentElement.style.setProperty('--overlay-box-shadow', boxShadow);
  };

  useEffect(() => {
    updateOverlayStyle('0px', 'transparent');
    return () => {
      updateOverlayStyle('12px', '0 8px 24px rgba(0, 0, 0, 0.25)');
    }
  }, []);

  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <div 
      className="h-full flex flex-col items-center" 
      onClick={(e) => {
        closeOverlay(e);
      }}
    >
      <div className="flex-1 flex items-center justify-center" onClick={(e) => closeOverlay(e)}>
        <div className="grid grid-cols-3 gap-2">
          {menuItems.map((item) => (
            <div
              key={item.label}
              className="text-white flex flex-col cursor-pointer items-center justify-center gap-2 p-2
                rounded-lg transition-all duration-200 
                transform hover:scale-105"
              onClick={() => navigate(item.path)}
            >
              <div>{item.shortcut}</div>
              <img 
                src={`${getLogoPath(item.icon)}`} 
                width="80%" 
                height="80%" 
                alt={`${item.label} logo`}
                className="mb-2"
              />
              <div className="text-center w-4/5">
                <div className="flex flex-col justify-center gap-1 items-center">
                  <div className="font-bold text-sm">{item.label}</div>
                  <p className="mt-1 text-xs">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="text-white/70 text-base mb-4 flex items-center gap-1">
        Hint: <Kbd>{getMetaKeyLabel()}</Kbd><Kbd>E</Kbd> toggles the previously opened view
      </div>
    </div>
  );
}
