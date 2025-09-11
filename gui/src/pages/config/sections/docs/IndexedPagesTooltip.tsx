import { EyeIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useDispatch } from "react-redux";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../../redux/slices/uiSlice";
import { fontSize } from "../../../../util";
import DocsDetailsDialog from "./DocsDetailsDialog";

interface IndexedPagesTooltipProps {
  pages: string[];
  siteTitle: string;
  baseUrl: string;
}

function removePrefix(str: string, prefix: string): string {
  return str.startsWith(prefix) ? str.slice(prefix.length) : str;
}

export const IndexedPagesTooltip = ({
  pages,
  siteTitle,
  baseUrl,
}: IndexedPagesTooltipProps) => {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();

  const handleEyeIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Open the DocsDetailsDialog component as a modal
    dispatch(setShowDialog(true));
    dispatch(setDialogMessage(<DocsDetailsDialog startUrl={baseUrl} />));
  };

  return (
    <div>
      <div
        className="mx-1 my-2 flex items-center justify-between font-semibold"
        style={{ fontSize: fontSize(-3) }}
      >
        <span>
          {siteTitle} - {pages.length} Pages Indexed
        </span>
        <EyeIcon
          className="ml-2 h-4 w-4 cursor-pointer text-red-500 transition-colors hover:text-red-400"
          onClick={handleEyeIconClick}
          title="View detailed docs information"
        />
      </div>
      <div className="max-h-48 overflow-y-auto px-1">
        <ul className="list-none pl-0">
          {pages.map((page, index) => (
            <li
              key={index}
              className="my-1 cursor-pointer truncate text-left text-gray-400 hover:underline"
              style={{ fontSize: fontSize(-4) }}
              onClick={() => {
                ideMessenger.post("openUrl", page);
              }}
            >
              {removePrefix(page, baseUrl)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
