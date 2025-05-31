import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Button, SecondaryButton, vscButtonBackground } from "../..";
import { fontSize } from "../../../util";
import { Listbox, ListboxButton, ListboxOptions, Transition } from "../../ui";
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
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span>
          {current}/{total}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-700">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: vscButtonBackground,
          }}
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
          <ListboxOptions className="min-w-80 pb-0">
            <div className="px-4 pb-4">
              <h3 className="mb-4 text-sm font-semibold">
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

              <div className="mt-4 flex gap-2">
                <SecondaryButton
                  className="flex-1"
                  onClick={() => {
                    // TODO: Implement eject from trial
                    console.log("Eject from trial clicked");
                  }}
                >
                  Eject from trial
                </SecondaryButton>
                <Button
                  className="flex-1"
                  onClick={() => {
                    // TODO: Implement upgrade
                    console.log("Upgrade clicked");
                  }}
                >
                  Upgrade
                </Button>
              </div>
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}
