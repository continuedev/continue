import React from "react";
import { 
  Listbox,
  ListboxButton,
  ListboxOptions,
  Transition,
} from "../../ui";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { fontSize } from "../../../util";
import { useFontSize } from "../../ui/font";

interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
}

function ProgressBar({ label, current, total }: ProgressBarProps) {
  const percentage = Math.min((current / total) * 100, 100);
  
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span>{current}/{total}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div 
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function FreeTrialButton() {
  const smallFont = useFontSize(-3);
  const tinyFont = useFontSize(-4);

  // Hardcoded values for now
  const autocompleteUsage = { current: 850, total: 2000 };
  const chatUsage = { current: 23, total: 50 };

  return (
    <Listbox>
      <div className="relative">
        <ListboxButton
          className="text-description border-none bg-transparent hover:brightness-125"
          style={{ fontSize: fontSize(-3) }}
        >
          <div className="flex flex-row items-center gap-1.5">
            <span className="line-clamp-1 select-none">Using free trial</span>
          </div>
          <ChevronDownIcon
            className="h-2 w-2 flex-shrink-0 select-none"
            aria-hidden="true"
          />
        </ListboxButton>

        <Transition>
          <ListboxOptions className="pb-0 min-w-80">
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-4">
                You are currently using the free trial
              </h3>
              
              <ProgressBar 
                label="Autocomplete usage"
                current={autocompleteUsage.current}
                total={autocompleteUsage.total}
              />
              
              <ProgressBar 
                label="Chat usage"
                current={chatUsage.current}
                total={chatUsage.total}
              />
              
              <div className="flex gap-2 mt-4">
                <button 
                  className="flex-1 px-3 py-2 text-sm border border-gray-600 rounded-md hover:bg-gray-700 transition-colors"
                  onClick={() => {
                    // TODO: Implement eject from trial
                    console.log("Eject from trial clicked");
                  }}
                >
                  Eject from trial
                </button>
                <button 
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  onClick={() => {
                    // TODO: Implement upgrade
                    console.log("Upgrade clicked");
                  }}
                >
                  Upgrade
                </button>
              </div>
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}