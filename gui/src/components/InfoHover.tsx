import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { ToolTip } from "./gui/Tooltip";

const DEFAULT_SIZE = "5";

const InfoHover = ({
  msg,
  size,
  id,
}: {
  id: string;
  msg: string;
  size?: string;
}) => {
  return (
    <ToolTip content={msg} place="bottom">
      <InformationCircleIcon
        className={`h-${size ?? DEFAULT_SIZE} w-${size ?? DEFAULT_SIZE} cursor-help text-gray-500`}
      />
    </ToolTip>
  );
};

export default InfoHover;
