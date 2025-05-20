import React from 'react';
import { ToolTip } from '../../gui/Tooltip'; // Adjusted path

interface ImprovePromptButtonProps {
  onClick: () => void;
}

const ImprovePromptButton: React.FC<ImprovePromptButtonProps> = ({ onClick }) => {
  const tooltipId = "improve-prompt-tooltip";
  return (
    <>
      <button
        onClick={onClick}
        className="text-gray-400 hover:underline px-1 focus:outline-none"
        data-tooltip-id={tooltipId}
      >
        Improve
      </button>
      <ToolTip id={tooltipId} place="top">
        Improve Prompt
      </ToolTip>
    </>
  );
};

export default ImprovePromptButton;
