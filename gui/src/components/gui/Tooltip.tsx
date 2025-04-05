import { CSSProperties } from "react";
import ReactDOM from "react-dom";
import { ITooltip, Tooltip } from "react-tooltip";
import { vscBackground, vscForeground, vscInputBorder } from "..";
import { fontSize } from "../../util";

const TooltipStyles: CSSProperties = {
  fontSize: fontSize(-2),
  backgroundColor: vscBackground,
  outline: `0.5px solid ${vscInputBorder}`,
  color: vscForeground,
  padding: "4px 8px",
  zIndex: 1000,
  maxWidth: "80vw",
  textAlign: "center",
};

export function ToolTip(props: ITooltip) {
  const combinedStyles = {
    ...TooltipStyles,
    ...props.style,
  };

  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  return (
    tooltipPortalDiv &&
    ReactDOM.createPortal(
      <Tooltip {...props} style={combinedStyles} opacity={1} delayShow={200} />,
      tooltipPortalDiv,
    )
  );
}
