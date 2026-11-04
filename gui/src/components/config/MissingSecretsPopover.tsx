import { ReactNode } from "react";

import { MissingSecret } from "../../util/missingSecrets";
import { Popover, PopoverButton, PopoverPanel } from "../ui";
import { MissingSecretsPanel } from "./MissingSecretsPanel";

interface MissingSecretsPopoverProps {
  missing: MissingSecret[];
  /** The element that opens the popover (an icon button). */
  children: ReactNode;
  className?: string;
  buttonTestId?: string;
  ariaLabel: string;
}

/**
 * Wraps an icon so that clicking it opens the missing-secrets panel. One
 * component for every place the warning shows up.
 */
export function MissingSecretsPopover({
  missing,
  children,
  className,
  buttonTestId,
  ariaLabel,
}: MissingSecretsPopoverProps) {
  return (
    <Popover className={`relative ${className ?? ""}`}>
      <PopoverButton
        aria-label={ariaLabel}
        data-testid={buttonTestId}
        className="m-0 flex cursor-pointer items-center border-none bg-transparent p-0"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {children}
      </PopoverButton>
      <PopoverPanel
        anchor="bottom start"
        className="z-[200000] rounded-sm border border-solid border-border bg-vsc-input-background shadow-md"
      >
        {({ close }: { close: () => void }) => (
          <MissingSecretsPanel missing={missing} onDone={close} />
        )}
      </PopoverPanel>
    </Popover>
  );
}
