import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { StyledTooltip } from ".";

const InfoHover = ({ msg }: { msg: string }) => {
  const id = "info-hover";

  return (
    <>
      <InformationCircleIcon
        data-tooltip-id={id}
        data-tooltip-content={msg}
        className="h-5 w-5 text-gray-500 cursor-help"
      />
      <StyledTooltip id={id} place="bottom" />
    </>
  );
};

export default InfoHover;
