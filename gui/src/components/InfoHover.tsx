import { InformationCircleIcon } from "@heroicons/react/24/outline";
import ReactDOM from "react-dom";
import { ToolTip } from "./gui/Tooltip";

const InfoHover = ({ msg }: { msg: string }) => {
  const id = `info-hover-${encodeURIComponent(msg)}`;

  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  return (
    <>
      <InformationCircleIcon
        data-tooltip-id={id}
        className="h-5 w-5 text-gray-500 cursor-help"
      />
      {tooltipPortalDiv &&
        ReactDOM.createPortal(
          <ToolTip id={id} place="bottom">
            {msg}
          </ToolTip>,
          tooltipPortalDiv,
        )}
    </>
  );
};

export default InfoHover;
