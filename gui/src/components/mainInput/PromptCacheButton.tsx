import { CircleStackIcon as CircleStackIconOutline } from "@heroicons/react/24/outline";
import { CircleStackIcon as CircleStackIconSolid } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setPromptCacheSetting } from "../../redux/slices/uiSlice";
import {
  modelSupportsOneHourCache,
  modelSupportsPromptCacheControl,
  PROMPT_CACHE_SETTING_LABELS,
  promptCacheStatus,
  promptCacheTooltip,
  type PromptCacheSetting,
} from "../../util/promptCache";
import { ToolTip } from "../gui/Tooltip";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "../ui";
import HoverItem from "./InputToolbar/HoverItem";

const CHOICES: (PromptCacheSetting | "config")[] = [
  "auto",
  "5m",
  "1h",
  "off",
  "config",
];

/** Re-render about every 15 s so the warm/expired state stays honest. */
function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function tooltipText(
  status: ReturnType<typeof promptCacheStatus>,
  setting: PromptCacheSetting | undefined,
): string {
  return promptCacheTooltip(status, setting);
}

/**
 * Toolbar control for prompt caching, next to the reasoning light bulb. Filled
 * when requests carry cache breakpoints, outlined when they do not. Shown only
 * for models whose provider honours it.
 */
export function PromptCacheButton() {
  const dispatch = useAppDispatch();
  const model = useAppSelector(selectSelectedChatModel);
  const setting = useAppSelector((s) =>
    model ? s.ui.promptCacheSettings?.[model.title] : undefined,
  );
  const sessionState = useAppSelector((s) => s.session.promptCache);
  const now = useNow();

  if (!model || !modelSupportsPromptCacheControl(model)) return null;

  const status = promptCacheStatus(
    model,
    setting,
    sessionState ?? { escalated: false },
    now,
  );
  const canOneHour = modelSupportsOneHourCache(model);
  const choices = CHOICES.filter((c) => canOneHour || c !== "1h");

  return (
    <Listbox
      value={setting ?? "config"}
      onChange={(choice: PromptCacheSetting | "config") =>
        dispatch(
          setPromptCacheSetting({
            modelTitle: model.title,
            setting: choice === "config" ? undefined : choice,
          }),
        )
      }
    >
      <div className="relative">
        <ToolTip place="top" content={tooltipText(status, setting)}>
          <ListboxButton
            data-testid="prompt-cache-button"
            aria-label="Prompt cache"
            className="m-0 flex-none border-none bg-transparent p-0 text-description hover:brightness-150"
          >
            <HoverItem as="span">
              {status.on ? (
                <CircleStackIconSolid
                  className={`h-3 w-3 ${status.warm ? "brightness-200" : "opacity-60"}`}
                />
              ) : (
                <CircleStackIconOutline className="h-3 w-3" />
              )}
            </HoverItem>
          </ListboxButton>
        </ToolTip>
        <ListboxOptions className="min-w-48 max-w-72">
          {choices.map((choice) => (
            <ListboxOption
              key={choice}
              value={choice}
              data-testid={`prompt-cache-option-${choice}`}
            >
              <div className="flex flex-col">
                <span>{PROMPT_CACHE_SETTING_LABELS[choice].label}</span>
                <span className="text-xs text-description-muted">
                  {PROMPT_CACHE_SETTING_LABELS[choice].detail}
                </span>
              </div>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
