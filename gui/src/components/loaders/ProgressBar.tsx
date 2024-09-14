import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import ReactDOM from "react-dom";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { StyledTooltip, lightGray, vscForeground } from "..";
import AddModelForm from "../../forms/AddModelForm";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import { getFontSize } from "../../util";
import { FREE_TRIAL_LIMIT_REQUESTS } from "../../util/freeTrial";

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
  cursor: pointer;
`;

const P = styled.p`
  margin: 0;
  margin-top: 2px;
  font-size: ${getFontSize() - 2.5}px;
  color: ${lightGray};
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

interface ProgressBarProps {
  completed: number;
  total: number;
}

const ProgressBar = ({ completed, total }: ProgressBarProps) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const fillPercentage = Math.min(100, Math.max(0, (completed / total) * 100));

  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  if (completed > total) {
    return (
      <>
        <div
          className="flex items-center gap-1 cursor-default"
          data-tooltip-id="usage_progress_bar"
        >
          <ExclamationCircleIcon width="18px" height="18px" color="red" />
          Trial limit reached
        </div>
        {tooltipPortalDiv &&
          ReactDOM.createPortal(
            <StyledTooltip id="usage_progress_bar" place="top">
              Configure a model above in order to continue
            </StyledTooltip>,
            tooltipPortalDiv,
          )}
      </>
    );
  }

  return (
    <>
      <GridDiv
        data-tooltip-id="usage_progress_bar"
        onClick={() => {
          dispatch(setShowDialog(true));
          dispatch(
            setDialogMessage(
              <AddModelForm
                onDone={() => {
                  dispatch(setShowDialog(false));
                  navigate("/");
                }}
              />,
            ),
          );
        }}
      >
        <ProgressBarWrapper>
          <ProgressBarFill
            completed={fillPercentage}
            color={
              completed / total > 0.75
                ? completed / total > 0.9
                  ? "#f00"
                  : "#fc0"
                : undefined
            }
          />
        </ProgressBarWrapper>
        <P>
          Free Uses: {completed} / {total}
        </P>
      </GridDiv>

      {tooltipPortalDiv &&
        ReactDOM.createPortal(
          <StyledTooltip id="usage_progress_bar" place="top">
            {`Click to use your own API key or local LLM (required after ${FREE_TRIAL_LIMIT_REQUESTS} inputs)`}
          </StyledTooltip>,
          tooltipPortalDiv,
        )}
    </>
  );
};

export default ProgressBar;
