import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { ToolTip } from "./gui/Tooltip";

const InfoHover = ({ msg }: { msg: string }) => {
  const id = `info-hover-${encodeURIComponent(msg)}`;

  return (
    <>
      <InformationCircleIcon
        data-tooltip-id={id}
        className="h-5 w-5 cursor-help text-gray-500"
      />

      <ToolTip id={id} place="bottom">
        {msg}
      </ToolTip>
    </>
  );
};

export default InfoHover;
