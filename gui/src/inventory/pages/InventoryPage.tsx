import { ReactElement, useState } from "react";
import { Search, Star } from "lucide-react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { getLogoPath } from "@/pages/welcome/setup/ImportExtensions";

interface AITool {
  id: string;
  name: string;
  description: ReactElement;
  icon: string;
  whenToUse: ReactElement;
  strengths: ReactElement[];
  weaknesses?: ReactElement[];
  enabled: boolean;
  comingSoon?: boolean;
  poweredBy?: string;
  installNeeded: boolean;
  note?: string;
}

const initialTools: AITool[] = [
  {
    id: "1",
    name: "Search",
    description: (
      <span>
        AI-powered search engine: up-to-date information for docs, libraries,
        etc.
      </span>
    ),
    icon: "inventory-search.svg",
    whenToUse: (
      <span>
        When you need to find information where recency is important. Regular
        LLMs' knowledge are outdated by several months, whereas PearAI Search is
        able to search the web for latest data
      </span>
    ),
    strengths: [
      <span>Most up-to-date information, real-time web search.</span>,
      <span>Also good for non-coding specific questions</span>,
      <span>Uses less credits than other tools</span>,
    ],
    poweredBy: "Perplexity",
    installNeeded: false,
    enabled: true,
  },
  {
    id: "2",
    name: "Chat",
    description: <span>AI pair programmer for flexible coding assistance</span>,
    icon: "inventory-chat.svg",
    whenToUse: (
      <span>
        When you need fragmented coding assistance and suggestions. Ask the chat
        any question, it can generate code and also create files.
        Requires human intervention to apply and review changes.
      </span>
    ),
    strengths: [
      <span>
        AI chat (<kbd>CMD/CTRL+L</kbd> and <kbd>CMD/CTRL+I</kbd>)
      </span>,
      <span>Context-aware suggestions</span>,
      <span>Code and file generation</span>,
      <span>
        Flexibility on choosing what you want to keep and discard from
        suggestions
      </span>,
    ],
    installNeeded: false,
    poweredBy: "Continue",
    enabled: true,
  },
  {
    id: "3",
    name: "Autocomplete",
    description: <span>Fast code autocomplete suggestions. Recommended as a standalone extension</span>,
    icon: "inventory-autocomplete.svg",
    whenToUse: (
      <span>
        When you need instant code completions while typing. Autocomplete offers
        real-time suggestions and completes your code with minimal latency,
        perfect for maintaining flow while coding
      </span>
    ),
    strengths: [
      <span>Lightning-fast completions</span>,
      <span>Context-aware suggestions</span>,
      <span>Low latency response times</span>,
      <span>Predicts where your cursor should go next</span>
    ],
    installNeeded: true,
    poweredBy: "Supermaven",
    enabled: true,
    note: "While we develop our own autocomplete service, we recommend Supermaven's autocomplete as an alternate standalone extension. They offer a great service and a free tier (requires separate login)." 
  },
  {
    id: "4",
    name: "Creator",
    description: <span>"No-code" assistant; complete features directly</span>,
    icon: "inventory-creator.svg",
    whenToUse: (
      <span>
        When you need a feature or a bug fix completed, Creator will find the
        relevant files, and make changes directly to your code. You can see
        diff changes in your source control tab afterwards
      </span>
    ),
    strengths: [
      <span>Full feature completions</span>,
      <span>Automated refactoring</span>,
      <span>Lower level of human intervention needed</span>,
    ],
    installNeeded: true,
    poweredBy: "aider",
    enabled: true,
  },
  {
    id: "5",
    name: "Painter",
    description: <span>AI image generation from textual descriptions</span>,
    icon: "🎨",
    whenToUse: (
      <span>
        Use when you need to create unique images based on text prompts
      </span>
    ),
    strengths: [
      <span>Creative image generation</span>,
      <span>Wide range of styles</span>,
      <span>Quick results</span>,
    ],
    enabled: false,
    comingSoon: true,
    poweredBy: "Flux",
    installNeeded: false,
  },
  {
    id: "6",
    name: "Memory",
    description: (
      <span>
        Personalization: let the AI remember your past thoughts (coming soon)
      </span>
    ),
    icon: "inventory-mem0.svg",
    whenToUse: (
      <span>
        When you want the AI to remember insights from past prompts you've given
        it. It can automatically remember details like what version of for e.g.
        Python you're using, or other specific details of your codebase, like
        your coding styles, or your expertise level
      </span>
    ),
    strengths: [
      <span>Intelligent memory of your coding profile</span>,
      <span>Increase in accuracy of results due to personalization</span>,
    ],
    enabled: false,
    comingSoon: true,
    poweredBy: "Mem0",
    installNeeded: false,
  },

];

const suggestedBuild = ["1", "2", "4", "6"]; // IDs of suggested tools

function AIToolCard({
  tool,
  onClick,
  onToggle,
}: {
  tool: AITool;
  onClick: () => void;
  onToggle: () => void;
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <Card
        className={`cursor-pointer h-35 overflow-hidden transition-all bg-input ${tool.comingSoon ? "opacity-50" : ""}`}
        onClick={tool.comingSoon ? undefined : onClick}
      >
        <CardContent className="px-3">
            {/* TODO: removed unfinished feature */}
            {/* <Tooltip>
              <TooltipTrigger asChild>
                <Switch
                  checked={tool.comingSoon ? false : true} // always enabled
                  aria-label={`Toggle ${tool.name}`}
                  disabled={true} // disable toggle for now
                  className={`bg-button text-button-foreground border border-input rounded-full transition-colors duration-200 ease-in-out ${
                    tool.comingSoon ? "opacity-50" : "opacity-100"
                  }`}
                />
              </TooltipTrigger>
              {!tool.comingSoon && (
                <TooltipContent>
                  <p className="text-xs bg-input p-1 px-2 rounded-xl">
                    Toggling coming soon
                  </p>
                </TooltipContent>
              )}
            </Tooltip> */}
          <h3
            className={`flex items-center gap-2 text-base font-semibold ${tool.enabled ? "text-foreground" : ""} transition-colors`}
          >
            {!tool.icon.endsWith(".svg") ? 
              <div className="text-2xl">
                {tool.icon}
              </div> : (
              <img 
                src={getLogoPath(tool.icon)} 
                className="w-6 h-6"
              />
            )}
            {tool.name}
          </h3>
          <p
            className={`text-xs ${tool.enabled ? "text-foreground" : "text-muted-foreground"}`}
          >
            {tool.comingSoon ? "Coming soon" : tool.description}
          </p>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// TODO: not used for now
// interface QuickActionSlotProps {
//   tool: AITool | null;
//   onRemove: () => void;
// }

// function QuickActionSlot({ tool, onRemove }: QuickActionSlotProps) {
//   return (
//     <div
//       className={`relative w-24 h-24 rounded-lg shadow-sm transition-all duration-200 ease-in-out
//                   flex flex-col items-center justify-center space-y-2
//                   hover:shadow-md
//                   ${tool ? "bg-button" : "bg-input"}
//                   ${tool ? "border border-input-border" : "border border-dashed border-input-border"}`}
//     >
//       {tool ? (
//         <>
//           <div className="text-3xl text-foreground">{tool.icon}</div>
//           <div className="text-xs font-medium text-center text-button-foreground px-2 line-clamp-2">
//             {tool.name}
//           </div>
//           <button
//             className="absolute top-0.5 right-1 p-0.5 m-1 text-foreground/50
//                        bg-button hover:bg-button-hover border-0
//                        rounded-md duration-200 ease-in-out"
//             onClick={onRemove}
//             aria-label={`Remove ${tool.name} from quick action slot`}
//           >
//             <XMarkIcon className="h-4 w-4" />
//           </button>
//         </>
//       ) : (
//         <div className="text-sm text-foreground/50">Empty</div>
//       )}
//     </div>
//   );
// }

export default function AIToolInventory() {
  const [tools, setTools] = useState<AITool[]>(initialTools);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedTool, setFocusedTool] = useState<AITool | null>(null);
  // TODO: not used for now
  // const [quickSlots, setQuickSlots] = useState<(AITool | null)[]>([
  //   null,
  //   null,
  //   null,
  //   null,
  // ]);

  const filteredTools = tools.filter((tool) =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleToggle = (id: string) => {
    setTools(
      tools.map((tool) =>
        tool.id === id ? { ...tool, enabled: !tool.enabled } : tool,
      ),
    );
  };

  // TODO: Not used for now
  // const handleEquipToQuickSlot = (tool: AITool) => {
  //   const emptySlotIndex = quickSlots.findIndex((slot) => slot === null);
  //   if (
  //     emptySlotIndex !== -1 &&
  //     !quickSlots.find((slot) => slot?.id === tool.id)
  //   ) {
  //     const newQuickSlots = [...quickSlots];
  //     newQuickSlots[emptySlotIndex] = tool;
  //     setQuickSlots(newQuickSlots);
  //   }
  // };

  // const handleRemoveFromQuickSlot = (index: number) => {
  //   const newQuickSlots = [...quickSlots];
  //   newQuickSlots[index] = null;
  //   setQuickSlots(newQuickSlots);
  // };

  const handleInstall = (tool: AITool) => {
    // TODO: implement install
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-[73vh] overflow-y-auto text-foreground">
        <header className="flex-none mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold mb-2 ml-4">PearAI Inventory</h1>
            <Badge variant="outline" className="pl-0">
              Beta
            </Badge>
            <div className="relative mt-2 w-full max-w-md">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground opacity-60"
                size={18}
              />
              <Input
                type="text"
                placeholder="Search AI tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 py-0 w-64 bg-input text-foreground border border-input rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                aria-label="Search AI tools"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 flex gap-4 min-h-0">
          <div className="w-1/2 flex flex-col">
            <div className="flex-1 overflow-y-auto pr-4 border-solid rounded-2xl p-2">
              {filteredTools.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {filteredTools.map((tool) => (
                    <AIToolCard
                      key={tool.id}
                      tool={tool}
                      onClick={() => setFocusedTool(tool)}
                      onToggle={() => handleToggle(tool.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-center">
                  <div className="text-muted-foreground">
                    <p className="text-lg font-semibold mb-2">
                      No tools match your search.
                    </p>
                    <p className="text-sm">
                      Try adjusting your search criteria.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="w-1/2 overflow-y-auto pl-4 border-l border-input text-sm border-solid rounded-2xl p-2 flex flex-col justify-between">
            {focusedTool ? (
              <>
                <div className="flex-grow text-foreground">
                  <h2 className="text-lg text-font-bold mb-2 flex items-start gap-1">
                    <div className="flex items-center gap-2">
                      {!focusedTool.icon.endsWith(".svg") ? 
                        <div className="text-2xl">
                          {focusedTool.icon}
                        </div> : (
                          <img 
                          src={getLogoPath(focusedTool.icon)} 
                          className="w-5 h-5"
                        />
                      )}
                    {focusedTool.name}
                    </div>
                    <Badge variant="outline" className="pl-0">Powered by {focusedTool.poweredBy}</Badge>
                  </h2>
                    <p className="mb-2">{focusedTool.description}</p>{" "}
                  <h3 className="font-semibold mb-1">When to use:</h3>
                    <p className="mb-2">{focusedTool.whenToUse}</p>{" "}
                  <h3 className="font-semibold mb-1">Strengths:</h3>
                    <ul className="list-disc mb-2 pl-4">
                      {focusedTool.strengths.map((strength, index) => (
                        <li key={index}>{strength}</li>
                      ))}
                    </ul>
                </div>
                {focusedTool.installNeeded && (
                <div className="mt-2 flex flex-col items-start gap-2 sticky bottom-0 bg-background p-2">
                {focusedTool?.note && <p className="text-sm text-muted-foreground">Note: {focusedTool.note}</p>}
                <Button
                  onClick={() => handleInstall(focusedTool)}
                  disabled={!focusedTool.installNeeded}
                >
                  Click to install
                </Button>
                {/* TODO: not used for now {quickSlots.every((slot) => slot !== null) && (
                  <p className="text-destructive mt-1 text-xs">
                    Quick slots are full
                  </p>
                )} */}
              </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-foreground opacity-60 mt-4 flex-grow">
                <p className="text-lg font-medium">No tool selected</p>
                <p className="text">Select a tool to view its details</p>
              </div>
            )}
          </div>
        </main>
        
        {/* TODO: quick action slots are removed for now since now fully finished */}
        {/* <footer className="flex-none mt-2 mb-2 p-2">
          <h3 className="flex items-center gap-1 font-semibold text-sm mb-2">
            Quick Action Slots{" "}
            <Badge variant="outline" className="pl-0">
              (Coming soon)
            </Badge>
          </h3>
          <div className="flex gap-1 mb-2">
            {quickSlots.map((slot, index) => (
              <QuickActionSlot
                key={index}
                tool={slot}
                onRemove={() => handleRemoveFromQuickSlot(index)}
              />
            ))}
          </div>
          <div className="flex mt-6 items-center text-xs">
            <Star className="text-accent mr-1" size={14} />
            <span className="font-medium">Suggested Build:</span>
            <div className="flex ml-2 space-x-1">
              {suggestedBuild.map((id) => {
                const tool = tools.find((t) => t.id === id);
                return tool ? (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center bg-button text-button-foreground rounded-full px-2 py-0.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <span className="mr-1">{tool.icon}</span>
                        <span className="truncate">{tool.name}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs bg-input p-1 px-2 rounded-xl">
                        {tool.description}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : null;
              })}
            </div>
          </div>
        </footer> */}
      </div>
    </TooltipProvider>
  );
}
