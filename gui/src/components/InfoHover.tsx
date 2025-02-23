import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { ReactNode } from "react";
import { ToolTip } from "./gui/Tooltip";

const DEFAULT_SIZE = "5";

const InfoHover = ({
  msg,
  size,
  id,
}: {
  id: string;
  msg: ReactNode;
  size?: string;
}) => {
  const dataTooltipId = `info-hover-${encodeURIComponent(id)}`;

  return (
    <>
      <InformationCircleIcon
        data-tooltip-id={dataTooltipId}
        className={`h-${size ?? DEFAULT_SIZE} w-${size ?? DEFAULT_SIZE} cursor-help text-gray-500`}
      />

      <ToolTip id={dataTooltipId} place="bottom">
        {msg}
      </ToolTip>
    </>
  );
};

export default InfoHover;
