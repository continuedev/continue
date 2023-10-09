import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { StyledTooltip } from ".";
import ReactDOM from "react-dom";

const InfoHover = ({ msg }: { msg: string }) => {
  const id = "info-hover";

  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  return (
    <>
      <InformationCircleIcon
        data-tooltip-id={id}
        className="h-5 w-5 text-gray-500 cursor-help"
      />
      {tooltipPortalDiv &&
        ReactDOM.createPortal(
          <StyledTooltip id={id} place="bottom">
            {msg}
          </StyledTooltip>,
          tooltipPortalDiv
        )}
    </>
  );
};

export default InfoHover;
