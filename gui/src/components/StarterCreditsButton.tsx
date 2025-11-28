import { GiftIcon } from "@heroicons/react/24/outline";
import { CreditStatus } from "core/control-plane/client";
import StarterCreditsPopover from "./StarterCreditsPopover";

interface FreeTrialButtonProps {
  creditStatus?: CreditStatus | null;
  refreshCreditStatus?: () => Promise<void>;
}

/**
 * @deprecated Use StarterCreditsPopover with a custom button/icon instead.
 * This component is kept for backward compatibility.
 */
export default function StarterCreditsButton({
  creditStatus,
  refreshCreditStatus,
}: FreeTrialButtonProps) {
  return (
    <StarterCreditsPopover
      creditStatus={creditStatus}
      refreshCreditStatus={refreshCreditStatus}
    >
      <span
        style={{
          paddingLeft: "8px",
          paddingRight: "8px",
          paddingTop: "2px",
          paddingBottom: "2px",
          cursor: "pointer",
          transition: "color 200ms, background-color 200ms, box-shadow 200ms",
          display: "inline-flex",
        }}
      >
        <GiftIcon className="text-description-muted h-3 w-3 hover:brightness-125" />
      </span>
    </StarterCreditsPopover>
  );
}
