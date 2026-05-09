import {
  CheckIcon,
  ChevronDownIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import ToggleSwitch from "../../../components/gui/Switch";
import { ToolTip } from "../../../components/gui/Tooltip";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../../../components/ui";

interface BaseUserSettingProps {
  title: string;
  description: React.ReactNode;
  disabled?: boolean;
}

interface ToggleUserSettingProps extends BaseUserSettingProps {
  type: "toggle";
  value: boolean;
  onChange: (value: boolean) => void;
}

interface NumberUserSettingProps extends BaseUserSettingProps {
  type: "number";
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

interface SelectUserSettingProps extends BaseUserSettingProps {
  type: "select";
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}

interface InputUserSettingProps extends BaseUserSettingProps {
  type: "input";
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  onSubmit?: () => void;
  onCancel?: () => void;
  isDirty?: boolean;
  isValid?: boolean;
}

type UserSettingProps =
  | ToggleUserSettingProps
  | NumberUserSettingProps
  | SelectUserSettingProps
  | InputUserSettingProps;

export function UserSetting(props: UserSettingProps) {
  const { title, description, disabled = false } = props;

  const renderControl = () => {
    switch (props.type) {
      case "toggle":
        return (
          <ToggleSwitch
            isToggled={props.value}
            disabled={disabled}
            onToggle={() => props.onChange(!props.value)}
            text=""
          />
        );

      case "number":
        return (
          <div className="border-command-border bg-vsc-input-background focus-within:border-border-focus focus-within:ring-border-focus flex w-24 items-center rounded-lg border border-solid focus-within:ring-1">
            <input
              type="number"
              value={props.value}
              onChange={(e) => {
                const value = Number(e.target.value);
                // Allow temporary invalid values during input
                props.onChange(value);
              }}
              onBlur={(e) => {
                // Apply min/max constraints when input loses focus
                const value = Number(e.target.value);
                const min = props.min ?? 0;
                const max = props.max ?? 100;

                if (value < min) {
                  props.onChange(min);
                } else if (value > max) {
                  props.onChange(max);
                }
              }}
              onKeyDown={(e) => {
                // Apply constraints when user presses Enter
                if (e.key === "Enter") {
                  const value = Number(e.currentTarget.value);
                  const min = props.min ?? 0;
                  const max = props.max ?? 100;

                  if (value < min) {
                    props.onChange(min);
                  } else if (value > max) {
                    props.onChange(max);
                  }

                  // Blur the input to complete the editing
                  e.currentTarget.blur();
                }
              }}
              min={props.min ?? 0}
              max={props.max ?? 100}
              disabled={disabled}
              className="text-vsc-foreground flex-1 border-none bg-transparent px-3 py-2 text-right text-sm outline-none focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        );

      case "select":
        return (
          <Listbox
            value={props.value}
            onChange={props.onChange}
            disabled={disabled}
          >
            <ListboxButton className="border-command-border !w-28 w-28 !flex-none justify-between !rounded-lg px-3 py-2 text-sm">
              {props.options.find((opt) => opt.value === props.value)?.label ||
                props.value}
              <ChevronDownIcon className="h-3 w-3" />
            </ListboxButton>
            <ListboxOptions className="!w-28 !min-w-0">
              {props.options.map((option) => (
                <ListboxOption key={option.value} value={option.value}>
                  {option.label}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Listbox>
        );

      case "input":
        if (props.onSubmit) {
          return (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                props.onSubmit?.();
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`border-command-border bg-vsc-input-background focus-within:border-border-focus focus-within:ring-border-focus flex w-full flex-row overflow-hidden rounded-lg border border-solid focus-within:ring-1 ${
                    props.isDirty
                      ? !props.isValid
                        ? "outline outline-red-500"
                        : "outline outline-green-500"
                      : ""
                  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <input
                    type="text"
                    value={props.value}
                    onChange={(e) => props.onChange(e.target.value)}
                    placeholder={props.placeholder}
                    disabled={disabled}
                    className="text-vsc-foreground flex-1 border-none bg-inherit px-3 py-2 text-sm outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
                  />
                </div>
                {props.isDirty && (
                  <div className="flex flex-row items-center gap-1">
                    <ToolTip content="Save">
                      <div onClick={props.onSubmit} className="cursor-pointer">
                        <CheckIcon className="h-4 w-4 text-green-500 hover:opacity-80" />
                      </div>
                    </ToolTip>
                    <ToolTip content="Cancel">
                      <div onClick={props.onCancel} className="cursor-pointer">
                        <XMarkIcon className="h-4 w-4 text-red-500 hover:opacity-80" />
                      </div>
                    </ToolTip>
                  </div>
                )}
              </div>
            </form>
          );
        }
        return (
          <div
            className={`border-command-border bg-vsc-input-background focus-within:border-border-focus focus-within:ring-border-focus flex w-full flex-row overflow-hidden rounded-lg border border-solid focus-within:ring-1 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <input
              type="text"
              value={props.value}
              onChange={(e) => props.onChange(e.target.value)}
              disabled={disabled}
              className="text-vsc-foreground flex-1 border-none bg-inherit px-3 py-2 text-sm outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
            />
          </div>
        );

      default:
        return null;
    }
  };

  // Use vertical layout for input types, horizontal for others
  const isInputType = props.type === "input";

  if (isInputType) {
    return (
      <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-medium leading-5">{title}</span>
          <div className="text-description-muted mt-1 text-xs leading-5">
            {description}
          </div>
        </div>
        <div className="w-full md:max-w-sm">{renderControl()}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-medium leading-5">{title}</span>
        <div className="text-description-muted mt-1 text-xs leading-5">
          {description}
        </div>
      </div>
      <div className="md:flex-shrink-0">{renderControl()}</div>
    </div>
  );
}
