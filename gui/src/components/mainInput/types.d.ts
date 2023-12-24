export type ComboBoxItemType = "contextProvider" | "slashCommand" | "file";

export interface ComboBoxItem {
  title: string;
  description: string;
  id?: string;
  content?: string;
  type: ComboBoxItemType;
}
