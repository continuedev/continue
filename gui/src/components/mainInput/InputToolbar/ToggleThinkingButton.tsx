import { Listbox } from "@headlessui/react";
import {
  EllipsisHorizontalCircleIcon as EllipsisHorizontalIcon,
  LightBulbIcon as LightBulbIconOutline,
} from "@heroicons/react/24/outline";
import { LightBulbIcon as LightBulbIconSolid } from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { lightGray, vscForeground } from "../..";
import { useAppSelector } from "../../../redux/hooks";
import { selectDefaultModel } from "../../../redux/slices/configSlice";
import { selectIsInEditMode } from "../../../redux/slices/sessionSlice";
import {
  setAnthropicBudgetTokens,
  setOpenAIReasoningEffort,
  toggleUseThinking,
} from "../../../redux/slices/uiSlice";
import { ToolTip } from "../../gui/Tooltip";
import InfoHover from "../../InfoHover";
import HoverItem from "./HoverItem";
import PopoverTransition from "./PopoverNoMoveTransition";

interface ThinkingButtonProps {
  disabled: boolean;
}

export default function ToggleThinkingButton(props: ThinkingButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dispatch = useDispatch();
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isThinkingHovered, setIsThinkingHovered] = useState(false);

  const useThinking = useAppSelector((state) => state.ui.useThinking);
  const thinkingSettings = useAppSelector((state) => state.ui.thinkingSettings);
  const defaultModel = useAppSelector(selectDefaultModel);
  const [showAbove, setShowAbove] = useState(false);
  const isInEditMode = useAppSelector(selectIsInEditMode);

  const ThinkingIcon = useThinking ? LightBulbIconSolid : LightBulbIconOutline;

  // Get provider from default model
  const provider = defaultModel?.provider || "";
  const hasThinkingOptions = provider !== "deepseek";
  const maxTokens = defaultModel?.completionOptions?.maxTokens || 8192;
  const minTokens = 1024;
  const maxBudgetTokens = Math.max(1024, maxTokens - 1024); // Leave room for response

  useEffect(() => {
    const checkPosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - rect.bottom;
        setShowAbove(spaceBelow < 250);
      }
    };

    if (isDropdownOpen) {
      checkPosition();
    }
  }, [isDropdownOpen]);

  const alwaysThinking =
    defaultModel?.model?.includes("deepseek-reasoner") ||
    defaultModel?.model?.includes("o1") ||
    defaultModel?.model?.includes("o3-mini");
  const isDisabled = props.disabled || isInEditMode;

  const handleToggleThinking = () => {
    if (isDisabled) return;
    if (alwaysThinking && useThinking) return; // Prevent turning off for special models
    dispatch(toggleUseThinking());
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${Math.round(tokens / 1000)}K`;
    }
    return tokens.toString();
  };

  // Create a ref to access the Listbox.Button
  const listboxButtonRef = useRef<HTMLButtonElement | null>(null);

  // Function to close dropdown by clicking the button
  const closeDropdown = () => {
    if (listboxButtonRef.current) {
      listboxButtonRef.current.click();
    }
  };

  // Get OpenAI icon color based on reasoning effort
  const getIconColor = () => {
    if (provider === "openai" && useThinking && !props.disabled) {
      const effort = thinkingSettings.openai.reasoningEffort;
      if (effort === "low") return "text-red-400";
      if (effort === "medium") return "text-yellow-400";
      if (effort === "high") return "text-green-400";
    }
    return "text-gray-400";
  };

  const iconColorClass = getIconColor();

  return (
    <HoverItem onClick={handleToggleThinking}>
      <div
        data-tooltip-id="thinking-tooltip"
        className={`-ml-1 -mt-1 flex flex-row items-center gap-1.5 rounded-md px-1 py-0.5 text-xs ${
          (useThinking || isHovered) && !isDisabled ? "bg-lightgray/30" : ""
        } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
        onMouseEnter={() => !isDisabled && setIsHovered(true)}
        onMouseLeave={() => {
          !isDisabled && setIsHovered(false);
          setIsThinkingHovered(false);
        }}
      >
        <ThinkingIcon
          onClick={() => setIsThinkingHovered(true)}
          className={`h-4 w-4 ${iconColorClass} ${
            isDisabled ? "cursor-not-allowed" : ""
          }`}
        />
        {isDisabled && (
          <ToolTip id="thinking-tooltip" place="top-middle">
            {isInEditMode
              ? "Thinking not supported in edit mode"
              : "This model does not support thinking"}
          </ToolTip>
        )}
        {!isDisabled && alwaysThinking && useThinking && (
          <ToolTip
            id="thinking-tooltip"
            place="top-middle"
            isOpen={isThinkingHovered}
          >
            Thinking can't be turned off for this model
          </ToolTip>
        )}
        {!useThinking && !isDisabled && !alwaysThinking && (
          <ToolTip id="thinking-tooltip" place="top-middle">
            Enable thinking
          </ToolTip>
        )}

        {useThinking && !isDisabled && (
          <>
            <span
              onClick={() => setIsThinkingHovered(true)}
              className="hidden align-top sm:flex"
            >
              Thinking
            </span>
            <Listbox
              value={null}
              onChange={() => {}}
              as="div"
              onClick={(e) => e.stopPropagation()}
              disabled={isDisabled}
            >
              {({ open }) => (
                <>
                  {hasThinkingOptions && (
                    <Listbox.Button
                      ref={(el) => {
                        buttonRef.current = el;
                        listboxButtonRef.current = el;
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDropdownOpen(!isDropdownOpen);
                      }}
                      className="text-lightgray flex cursor-pointer items-center border-none bg-transparent px-0 outline-none"
                      aria-disabled={isDisabled}
                    >
                      <EllipsisHorizontalIcon className="h-3 w-3 cursor-pointer hover:brightness-125" />
                    </Listbox.Button>
                  )}
                  <PopoverTransition
                    show={open}
                    afterLeave={() => setDropdownOpen(false)}
                  >
                    <Listbox.Options
                      className={`bg-vsc-editor-background border-lightgray/50 absolute left-2 z-50 mb-1 min-w-fit whitespace-nowrap rounded-md border border-solid px-1 py-0 shadow-lg ${showAbove ? "bottom-full" : ""}`}
                      static
                    >
                      <div className="sticky">
                        <div
                          className="mb-1 flex items-center gap-2 px-2 py-1 text-xs"
                          style={{
                            color: vscForeground,
                            borderBottom: `1px solid ${lightGray}`,
                          }}
                        >
                          Thinking Settings{" "}
                          <InfoHover
                            id={"thinking-settings"}
                            size={"3"}
                            msg={
                              <div
                                className="gap-0 *:m-1 *:text-left"
                                style={{ fontSize: "10px" }}
                              >
                                <p>
                                  Control how much effort the model puts into
                                  reasoning
                                </p>
                                {provider === "anthropic" && (
                                  <p>
                                    Budget tokens: How many tokens to dedicate
                                    to thinking
                                  </p>
                                )}
                                {provider === "openai" && (
                                  <p>
                                    Reasoning effort: Amount of effort to put
                                    into reasoning
                                  </p>
                                )}
                              </div>
                            }
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto overflow-x-hidden p-2">
                        {provider === "anthropic" && (
                          <div className="text-vsc-foreground xs:w-48 w-[9rem] sm:w-52">
                            <div className="flex items-center justify-between">
                              <span className="text-xs">Budget Tokens</span>
                              <span className="text-xs font-medium">
                                {formatTokens(
                                  thinkingSettings.anthropic.budgetTokens,
                                )}
                                /{formatTokens(maxTokens)}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center">
                              <span className="mr-2 text-xs">1K</span>
                              <input
                                type="range"
                                min={minTokens}
                                max={maxBudgetTokens}
                                step={1024}
                                value={thinkingSettings.anthropic.budgetTokens}
                                onChange={(e) => {
                                  dispatch(
                                    setAnthropicBudgetTokens(
                                      parseInt(e.target.value),
                                    ),
                                  );
                                }}
                                className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                              />
                              <span className="ml-2 text-xs">
                                {formatTokens(maxBudgetTokens)}
                              </span>
                            </div>
                          </div>
                        )}
                        {provider === "openai" && (
                          <div className="text-vsc-foreground w-40">
                            <span className="text-xs">Reasoning Effort</span>
                            <div className="mt-2 space-y-1">
                              {["high", "medium", "low"].map((level) => (
                                <div
                                  key={level}
                                  className={`flex cursor-pointer items-center rounded px-2 py-1 hover:bg-gray-700 ${thinkingSettings.openai.reasoningEffort === level ? "bg-gray-700" : ""}`}
                                  onClick={() => {
                                    dispatch(
                                      setOpenAIReasoningEffort(
                                        level as "low" | "medium" | "high",
                                      ),
                                    );
                                    closeDropdown();
                                    setIsHovered(false);
                                  }}
                                >
                                  <div
                                    className={`h-2 w-2 rounded-full ${level === "low" ? "bg-red-400" : level === "medium" ? "bg-yellow-400" : "bg-green-400"} mr-2`}
                                  ></div>
                                  <span className="text-xs capitalize">
                                    {level}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </Listbox.Options>
                  </PopoverTransition>
                </>
              )}
            </Listbox>
          </>
        )}
      </div>
    </HoverItem>
  );
}
