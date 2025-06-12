import { ToolImpl } from ".";
import { getUrlContextItems } from "../../context/providers/URLContextProvider";

export const fetchUrlContentImpl: ToolImpl = async (args, extras) => {
  return getUrlContextItems(args.url, extras.fetch);
};
