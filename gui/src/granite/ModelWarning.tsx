import React from 'react';
import { VscWarning, VscError } from "react-icons/vsc";

interface ModelWarningProps {
  warnings: string[];
  errors: string[];
  className?: string;
}

const ModelWarning: React.FC<ModelWarningProps> = ({ warnings, errors, className }) => {
  if (warnings.length === 0 && errors.length === 0) { return null; }

  return (
    <div className={`model-warning ${className || ''}`}>
      {errors.map((error, index) => (
        <div key={`error-${index}`} className="error-message">
          <VscError />
          {error}
        </div>
      ))}
      {warnings.map((warning, index) => (
        <div key={`warning-${index}`} className="warning-message">
          <VscWarning />
          {warning}
        </div>
      ))}
    </div>
  );
};

export default ModelWarning;