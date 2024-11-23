import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { ToolTip } from "./gui/Tooltip";

const DEFAULT_SIZE = "5";

const InfoHover = ({ msg, size }: { msg: string; size?: string }) => {
  const id = `info-hover-${encodeURIComponent(msg)}`;

  return (
    <>
      <InformationCircleIcon
        data-tooltip-id={id}
        className={`h-${size ?? DEFAULT_SIZE} w-${size ?? DEFAULT_SIZE} cursor-help text-gray-500`}
      />

      <ToolTip id={id} place="bottom">
        {msg}
      </ToolTip>
    </>
  );
};

export default InfoHover;
