import { Tooltip } from "react-tooltip";
import { vscInputBackground, vscBadgeBackground, vscForeground } from "..";
import { getFontSize } from "../../util";

const TooltipStyles = {
  fontSize: `${getFontSize() - 2}px`,
  backgroundColor: vscInputBackground,
  boxShadow: `0px 0px 2px 1px ${vscBadgeBackground}`,
  color: vscForeground,
  padding: "2px 6px",
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

  return <Tooltip {...props} style={combinedStyles} />;
}
