import InventoryPage from "../inventory/pages/InventoryPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Gui from "./gui";

const TemplateComponent = ({ name }: { name: string }) => {
  return (
    <div className="flex items-center justify-center h-screen text-7xl">
      {name} here
    </div>
  );
};

const tabs = [
  {
    id: "aider",
    name: "Creator (aider)",
    component: <Gui/>,
  },
  { id: "inventory", name: "Inventory", component: <InventoryPage /> },
  {
    id: "perplexity",
    name: "Search (Perplexity)",
    component: <TemplateComponent name="Perplexity" />,
  },
];

export default function Inventory() {
  return (
    <div className="h-full">
      <Tabs defaultValue="inventory">
        <div className="flex justify-center mt-1">
          <TabsList className="bg-input text-center">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="text-[0.60rem]"
              >
                {tab.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="">
            {tab.component}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
