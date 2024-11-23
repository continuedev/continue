import { ContextItem, ToolExtras } from "../..";

export type ToolImpl = (
  parameters: any,
  extras: ToolExtras,
) => Promise<ContextItem[]>;
