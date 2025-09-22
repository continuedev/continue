import React from "react";
import { HoverDiv, HoverTextDiv } from "./StyledComponents";

interface DragOverlayProps {
  show: boolean;
}

export const DragOverlay: React.FC<DragOverlayProps> = ({ show }) => {
  if (!show) return null;

  return (
    <>
      <HoverDiv />
      <HoverTextDiv>Hold ⇧ to drop image</HoverTextDiv>
    </>
  );
};
