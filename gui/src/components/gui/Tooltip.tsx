import ReactDOM from "react-dom";
import { Tooltip } from "react-tooltip";
import { vscForeground, vscInputBackground } from "..";
import { getFontSize } from "../../util";

const TooltipStyles = {
  fontSize: `${getFontSize() - 2}px`,
  backgroundColor: vscInputBackground,
  color: vscForeground,
  padding: "4px 8px",
  zIndex: 1000,
  maxWidth: "80vw",
  textAlign: "center",
  overflow: "hidden",
};

export function ToolTip(props: any) {
  const combinedStyles = {
    ...TooltipStyles,
    ...props.style,
  };

  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  return (
    tooltipPortalDiv &&
    ReactDOM.createPortal(
      <Tooltip {...props} style={combinedStyles} opacity={1} />,
      tooltipPortalDiv,
    )
  );
}
