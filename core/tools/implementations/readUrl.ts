import { ToolImpl } from ".";
import { getUrlContextItems } from "../../context/providers/URLContextProvider";

export const readUrlImpl: ToolImpl = async (args, extras) => {
  return getUrlContextItems(args.url, extras.fetch);
};
