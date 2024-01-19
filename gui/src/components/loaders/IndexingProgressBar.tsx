import ReactDOM from "react-dom";
import styled from "styled-components";
import { StyledTooltip, lightGray, vscForeground } from "..";

const ProgressBarWrapper = styled.div`
  width: 100px;
  height: 6px;
  border-radius: 6px;
  border: 0.5px solid ${lightGray};
  margin-top: 6px;
`;

const ProgressBarFill = styled.div<{ completed: number; color?: string }>`
  height: 100%;
  background-color: ${(props) => props.color || vscForeground};
  border-radius: inherit;
  transition: width 0.2s ease-in-out;
  width: ${(props) => props.completed}%;
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-rows: 1fr auto;
  align-items: center;
  justify-items: center;
  margin-left: 8px;
`;

const P = styled.p`
  margin: 0;
  margin-top: 2px;
  font-size: 11.5px;
  color: ${lightGray};
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

interface ProgressBarProps {
  completed: number;
  total: number;
  currentlyIndexing?: string;
}

const IndexingProgressBar = ({
  completed,
  total,
  currentlyIndexing,
}: ProgressBarProps) => {
  const fillPercentage = Math.min(100, Math.max(0, (completed / total) * 100));

  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  return (
    <>
      <GridDiv data-tooltip-id="usage_progress_bar">
        <ProgressBarWrapper>
          <ProgressBarFill completed={fillPercentage} />
        </ProgressBarWrapper>
        <P>Indexing ({Math.trunc((completed / total) * 100)}%)</P>
      </GridDiv>
      {tooltipPortalDiv &&
        ReactDOM.createPortal(
          <StyledTooltip id="usage_progress_bar" place="top">
            {currentlyIndexing}
          </StyledTooltip>,
          tooltipPortalDiv
        )}
    </>
  );
};

export default IndexingProgressBar;
