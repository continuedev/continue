import { CSSProperties, ReactElement, cloneElement, useId, isValidElement } from "react";
import ReactDOM from "react-dom";
import { Tooltip } from "react-tooltip";
import { vscBackground, vscForeground } from "..";
import { varWithFallback } from "../../styles/theme";
import { fontSize } from "../../util";

// Needed to override styles in react-tooltip
const TooltipStyles: CSSProperties = {
  fontSize: fontSize(-4),
  backgroundColor: vscBackground,
  outline: `0.5px solid ${varWithFallback("badge-background")}`,
  color: vscForeground,
  padding: "4px 8px",
  zIndex: 1000,
  maxWidth: "80vw",
  textAlign: "center",
};

// Backward-compatible ToolTip wrapper that supports both legacy (id + content children)
// and new API (content prop + child trigger element)
export function ToolTip(props: any) {
  const { children, content, id, ...rest } = props ?? {};

  const combinedStyles = {
    ...TooltipStyles,
    ...rest.style,
  };

  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  // New API: content + trigger element passed as children
  if (content && isValidElement(children)) {
    const tooltipId = useId();
    const childrenWithTooltipId = cloneElement(children as ReactElement, {
      "data-tooltip-id": tooltipId,
    });

    return (
      <>
        {childrenWithTooltipId}
        {tooltipPortalDiv &&
          ReactDOM.createPortal(
            <Tooltip
              {...rest}
              id={tooltipId}
              noArrow
              style={combinedStyles}
              opacity={1}
              delayShow={200}
            >
              {content}
            </Tooltip>,
            tooltipPortalDiv,
          )}
      </>
    );
  }

  // Legacy API: render tooltip with provided id and children as content
  return (
    tooltipPortalDiv &&
    ReactDOM.createPortal(
      <Tooltip
        {...props}
        noArrow
        style={combinedStyles}
        opacity={1}
        delayShow={200}
      />,
      tooltipPortalDiv,
    )
  );
}
