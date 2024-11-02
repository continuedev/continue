import InventoryPage from "../inventory/pages/InventoryPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PerplexityGUI from "@/integrations/perplexity/perplexitygui";
import AiderGUI from "@/integrations/aider/aidergui";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useWebviewListener } from "@/hooks/useWebviewListener";


const tabs = [
  { id: "inventory", name: "Inventory", component: <InventoryPage /> },
  {
    id: "aiderMode",
    name: "Creator (aider)",
    component: <AiderGUI />,
  },
  {
    id: "perplexityMode",
    name: "Search (Perplexity)",
    component: <PerplexityGUI />,
  },
];

export default function Inventory() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("inventory");
  const currentTab = location.pathname.split("/").pop() || "inventory";
  const platform = navigator.userAgent.toLowerCase();

  // Update activeTab whenever location changes
  useEffect(() => {
    const tab = location.pathname.split("/").pop() || "inventory";
    setActiveTab(tab);
  }, [location]);


  // listen for navigation change requests from vscode
  useWebviewListener(
    "navigateToCreator",
    async () => {
      setActiveTab("aiderMode"); // Set active tab immediately
      navigate("/inventory/aiderMode");
    },
    [],
  );

  useWebviewListener(
    "navigateToSearch",
    async () => {
      setActiveTab("perplexityMode"); // Set active tab immediately
      navigate("/inventory/perplexityMode");
    },  
    [],
  );

  useWebviewListener(
    "navigateToInventory",
    async () => {
      setActiveTab("inventory"); // Set active tab immediately
      navigate("/inventory");
    },  
    [],
  );

  // IDE event listeners
  useWebviewListener(
    "getCurrentTab",
    async () => {
      return activeTab;
    },
    [activeTab], // Add dependency to ensure we have latest value
  );

  const handleTabChange = (value: string) => {
    setActiveTab(value); // Update active tab immediately
    if (value === "inventory") {
      navigate("/inventory");
      return;
    }
    navigate(`/inventory/${value}`);
  };

  const isMac = platform.includes("mac");
  const modifierKey = isMac ? '⌘' : "Ctrl";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Tabs
        value={currentTab}
        defaultValue="inventory"
        onValueChange={handleTabChange}
        className="flex flex-col h-full"
      >
        <div className="flex flex-col h-full">
          <div className="top-0 px-4 pt-4 z-10">
            <TabsList className="bg-input text-center">
              {tabs.map((tab, index) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`text-xs font-medium px-3 py-1 rounded transition-all duration-300 ${
                    currentTab === tab.id
                      ? "bg-primary text-primary-foreground border-b-2 border-accent"
                      : "text-foreground hover:bg-muted hover:text-muted-foreground"
                  }`}
                >
                  {`${tab.name}`}
                  <kbd className="ml-1">{modifierKey}</kbd><kbd className="ml-1">{index + 1}</kbd>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 p-4 pt-0 overflow-hidden">
            {tabs.map((tab) => (
              <TabsContent
                key={tab.id}
                value={tab.id}
                className="h-full data-[state=active]:flex flex-col"
              >
                {tab.component}
              </TabsContent>
            ))}
          </div>
        </div>
      </Tabs>
    </div>
  );
}
