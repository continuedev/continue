import React from "react";
import styled from "styled-components";
import { StyledTooltip, lightGray, vscForeground } from ".";

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
`;

const P = styled.p`
  margin: 0;
  margin-top: 2px;
  font-size: 12px;
  color: ${lightGray};
  text-align: center;
`;

interface ProgressBarProps {
  completed: number;
  total: number;
}

const ProgressBar = ({ completed, total }: ProgressBarProps) => {
  const fillPercentage = Math.min(100, Math.max(0, (completed / total) * 100));

  return (
    <>
      <a
        href="https://continue.dev/docs/customization"
        className="no-underline"
      >
        <GridDiv data-tooltip-id="usage_progress_bar">
          <ProgressBarWrapper>
            <ProgressBarFill
              completed={fillPercentage}
              color={
                completed / total > 0.75
                  ? completed / total > 0.95
                    ? "#f00"
                    : "#fc0"
                  : undefined
              }
            />
          </ProgressBarWrapper>
          <P>
            Free Usage: {completed} / {total}
          </P>
        </GridDiv>
      </a>
      <StyledTooltip id="usage_progress_bar" place="bottom">
        {
          "Continue allows you to use our OpenAI API key for up to 250 inputs. After this, you can either use your own API key, or use a local LLM. Click the progress bar to go to the docs and learn more."
        }
      </StyledTooltip>
    </>
  );
};

export default ProgressBar;
