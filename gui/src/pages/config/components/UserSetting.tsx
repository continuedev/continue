import React from "react";
import NumberInput from "../../../components/gui/NumberInput";
import ToggleSwitch from "../../../components/gui/Switch";
import { Input } from "../../../components";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../../../components/ui/Listbox";
import {
  ChevronDownIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

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
          <NumberInput
            value={props.value}
            onChange={props.onChange}
            min={props.min ?? 0}
            max={props.max ?? 100}
            disabled={disabled}
          />
        );

      case "select":
        return (
          <Listbox
            value={props.value}
            onChange={props.onChange}
            disabled={disabled}
          >
            <ListboxButton className="justify-between px-3 py-2">
              {props.options.find((opt) => opt.value === props.value)?.label ||
                props.value}
              <ChevronDownIcon className="h-4 w-4" />
            </ListboxButton>
            <ListboxOptions className="min-w-0">
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
                <Input
                  value={props.value}
                  className={`max-w-[200px] ${
                    props.isDirty
                      ? !props.isValid
                        ? "outline-red-500"
                        : "outline-green-500"
                      : ""
                  }`}
                  onChange={(e) => props.onChange(e.target.value)}
                  disabled={disabled}
                />
                <div className="flex h-full flex-col">
                  {props.isDirty ? (
                    <>
                      <div onClick={props.onSubmit} className="cursor-pointer">
                        <CheckIcon className="h-4 w-4 text-green-500 hover:opacity-80" />
                      </div>
                      <div onClick={props.onCancel} className="cursor-pointer">
                        <XMarkIcon className="h-4 w-4 text-red-500 hover:opacity-80" />
                      </div>
                    </>
                  ) : (
                    <div>
                      <CheckIcon className="text-vsc-foreground-muted h-4 w-4" />
                    </div>
                  )}
                </div>
              </div>
            </form>
          );
        }
        return (
          <Input
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            className={props.className}
            disabled={disabled}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex items-start justify-between">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <div className="mt-0.5 text-xs text-gray-500">{description}</div>
      </div>
      {renderControl()}
    </div>
  );
}
