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
          <div className="border-command-border bg-vsc-input-background focus-within:border-border-focus focus-within:ring-border-focus flex w-20 items-center rounded-md border border-solid focus-within:ring-1">
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
              className="text-vsc-foreground flex-1 border-none bg-transparent px-2 py-1 text-right outline-none focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
            <ListboxButton className="border-command-border !w-20 w-20 !flex-none justify-between !rounded-md px-2 py-1">
              {props.options.find((opt) => opt.value === props.value)?.label ||
                props.value}
              <ChevronDownIcon className="h-3 w-3" />
            </ListboxButton>
            <ListboxOptions className="!w-20 !min-w-0">
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
                  className={`border-command-border bg-vsc-input-background focus-within:border-border-focus focus-within:ring-border-focus flex w-full flex-row overflow-hidden rounded-md border border-solid focus-within:ring-1 ${
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
                    className="text-vsc-foreground flex-1 border-none bg-inherit px-1.5 py-1 outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
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
            className={`border-command-border bg-vsc-input-background focus-within:border-border-focus focus-within:ring-border-focus flex w-full flex-row overflow-hidden rounded-md border border-solid focus-within:ring-1 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <input
              type="text"
              value={props.value}
              onChange={(e) => props.onChange(e.target.value)}
              disabled={disabled}
              className="text-vsc-foreground flex-1 border-none bg-inherit px-1.5 py-1 outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
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
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{title}</span>
          <div className="mt-0.5 text-xs text-gray-500">{description}</div>
        </div>
        {renderControl()}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-start gap-4">
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-medium">{title}</span>
        <div className="mt-0.5 text-xs text-gray-500">{description}</div>
      </div>
      {renderControl()}
    </div>
  );
}
