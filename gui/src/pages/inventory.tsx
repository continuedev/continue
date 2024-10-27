import InventoryPage from "../inventory/pages/InventoryPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PerplexityGUI from "@/integrations/perplexity/perplexitygui";
import AiderGUI from "@/integrations/aider/aidergui";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

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
  const currentTab = location.pathname.split("/").pop() || "inventory";

  const handleTabChange = (value: string) => {
    if (value === "inventory") {
      navigate("/inventory");
      return;
    }
    navigate(`/inventory/${value}`);
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        (activeElement.isContentEditable ||
          activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT")
      ) {
        return;
      }
      if (event.key >= "1" && event.key <= "3") {
        // Convert key to index (0-2)
        const index = parseInt(event.key) - 1;
        if (index >= 0 && index < tabs.length) {
          handleTabChange(tabs[index].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

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
                  <kbd className="ml-1">{index + 1}</kbd>
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
