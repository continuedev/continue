import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { ReactNode } from "react";
import { ToolTip } from "./gui/Tooltip";

const DEFAULT_SIZE = "5";

const sizeMap = {
  "3": "h-3 w-3",
  "4": "h-4 w-4",
  "5": "h-5 w-5",
  "6": "h-6 w-6",
  "8": "h-8 w-8",
} as const;

const InfoHover = ({
  msg,
  size,
  id,
}: {
  id: string;
  msg: ReactNode;
  size?: string;
}) => {
  const sizeClasses =
    sizeMap[size as keyof typeof sizeMap] ||
    sizeMap[DEFAULT_SIZE as keyof typeof sizeMap];

  return (
    <ToolTip content={msg} place="bottom">
      <InformationCircleIcon className={`${sizeClasses} text-gray-500`} />
    </ToolTip>
  );
};

export default InfoHover;
