import InventoryPage from "../inventory/pages/InventoryPage";
import HomePage from "@/inventory/pages/HomePage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PerplexityGUI from "@/integrations/perplexity/perplexitygui";
import AiderGUI from "@/integrations/aider/aidergui";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, ReactNode } from "react";
import { useWebviewListener } from "@/hooks/useWebviewListener";

const tabs = [
  { 
    id: "home", 
    name: "Home", 
    component: <HomePage />, 
    shortcut: <kbd className="ml-[1.5px]">1</kbd> 
  },
  { 
    id: "aiderMode", 
    name: "Creator", 
    component: <AiderGUI />, 
    shortcut: <kbd className="ml-[1.5px]">2</kbd> 
  },
  { 
    id: "perplexityMode", 
    name: "Search", 
    component: <PerplexityGUI />, 
    shortcut: <kbd className="ml-[1.5px]">3</kbd> 
  },
  { 
    id: "inventory", 
    name: "Inventory", 
    component: <InventoryPage />, 
    shortcut: <><kbd className="ml-[1.5px]">SHIFT</kbd><kbd className="ml-[1.5px]">1</kbd></> 
  },
];

interface TabButtonProps {
  id: string;
  name: string;
  shortcut: ReactNode;
}

export default function Inventory() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("inventory");
  const currentTab = location.pathname.split("/").pop() || "inventory";
  const isMac = navigator.userAgent.toLowerCase().includes("mac");
  const modifierKey = isMac ? '⌘' : "Ctrl";

  useEffect(() => {
    const tab = location.pathname.split("/").pop() || "inventory";
    setActiveTab(tab);
  }, [location]);

  useWebviewListener("navigateToInventoryHome", () => handleTabChange("home"), []);
  useWebviewListener("navigateToCreator", () => handleTabChange("aiderMode"), []);
  useWebviewListener("navigateToSearch", () => handleTabChange("perplexityMode"), []);
  useWebviewListener("navigateToInventory", () => handleTabChange("inventory"), []);
  useWebviewListener("getCurrentTab", async () => activeTab, [activeTab]);

  const handleTabChange = async (value: string) => {
    setActiveTab(value);
    navigate(value === "inventory" ? "/inventory" : `/inventory/${value}`);
  };

  const TabButton = ({ id, name, shortcut }: TabButtonProps) => (
    <TabsTrigger
      value={id}
      className={`text-xs font-medium px-3 py-1 rounded transition-all duration-300 ${
        currentTab === id
          ? ""
          : "hover:opacity-80 hover:text-muted-foreground"
      }`}
    >
      {name}
      <kbd className="ml-1">{modifierKey}</kbd>
      {shortcut}
    </TabsTrigger>
  );

  return (
    <div className={`h-full w-full flex flex-col ${activeTab === "home" ? "bg-transparent" : "bg-background"}`}>
      <Tabs
        value={currentTab}
        defaultValue="inventory"
        onValueChange={handleTabChange}
        className="flex flex-col h-full"
      >
        <div className="flex flex-col h-full">
          <div className="top-0 px-4 pt-4 z-10">
            <TabsList className={`flex justify-between ${currentTab === 'home' ? 'hidden' : ''}`}>
              <div className="flex">
                <TabButton {...tabs[0]} />
              </div>
              <div className="flex gap-1">
                <TabButton {...tabs[1]} />
                <TabButton {...tabs[2]} />
              </div>
              <div className="flex">
                <TabButton {...tabs[3]} />
              </div>
            </TabsList>
          </div>

          <div className="flex-1 p-4 pt-0 overflow-hidden">
            {tabs.map(({ id, component }) => (
              <TabsContent
                key={id}
                value={id}
                className="h-[73vh] data-[state=active]:flex flex-col"
              >
                {component}
              </TabsContent>
            ))}
          </div>
        </div>
      </Tabs>
    </div>
  );
}
