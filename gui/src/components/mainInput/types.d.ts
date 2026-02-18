import { ContextProviderDescription, SlashCommandSource } from "core";

export type ComboBoxItemType =
  | "contextProvider"
  | "slashCommand"
  | "file"
  | "query"
  | "folder"
  | "action";

export interface ComboBoxSubAction {
  label: string;
  icon: string;
  action: (item: ComboBoxItem) => void;
}

export interface ComboBoxItem {
  title: string;
  description: string;
  id?: string;
  content?: string;
  type: ComboBoxItemType;
  contextProvider?: ContextProviderDescription;
  query?: string;
  label?: string;
  icon?: string;
  action?: () => void;
  subActions?: ComboBoxSubAction[];
  slashCommandSource?: SlashCommandSource;
}
