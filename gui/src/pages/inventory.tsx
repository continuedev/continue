import InventoryPage from "../inventory/pages/InventoryPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PerplexityGUI from "@/integrations/perplexity/perplexitygui";
import AiderGUI from "@/integrations/aider/aidergui";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const TemplateComponent = ({ name }: { name: string }) => {
  return (
    <div className="flex items-center justify-center h-screen text-7xl">
      {name} here
    </div>
  );
};

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

  // // Set initial path if on root inventory path
  // useEffect(() => {
  //   if (location.pathname === '/inventory') {
  //     navigate('/inventory/inventory');
  //   }
  // }, [location.pathname, navigate]);

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
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`text-xs font-medium px-3 py-1 rounded transition-all duration-300 ${
                    currentTab === tab.id
                      ? "bg-primary text-primary-foreground border-b-2 border-accent"
                      : "text-foreground hover:bg-muted hover:text-muted-foreground"
                  }`}
                >
                  {tab.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {/* commenting out for now, it will be handy until we finish developing the overlay feature */}
            {/* <span className="ml-2 text-sm text-muted-foreground">
              Current path: {location.pathname}
            </span> */}
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
