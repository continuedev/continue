import React from "react";

// Mock FreeTrialStatus component that doesn't create any timers
const FreeTrialStatus: React.FC<any> = () => {
  return null;
};

export { FreeTrialStatus };
export function isModelUsingFreeTrial(): boolean {
  return false;
}
