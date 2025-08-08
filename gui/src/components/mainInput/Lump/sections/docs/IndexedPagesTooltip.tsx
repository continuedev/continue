import { useContext } from "react";
import { IdeMessengerContext } from "../../../../../context/IdeMessenger";
import { fontSize } from "../../../../../util";

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

  return (
    <div>
      <div className="mt-2 font-semibold" style={{ fontSize: fontSize(-3) }}>
        {siteTitle} - {pages.length} Pages Indexed
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
