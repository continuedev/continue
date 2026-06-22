import React from "react";

export function Steps({ children }: { children: React.ReactNode }) {
  const childArray = React.Children.toArray(children).filter(
    React.isValidElement,
  );
  return (
    <div className="my-6">
      {childArray.map((child, index) =>
        React.cloneElement(child as React.ReactElement<any>, {
          stepNumber: index + 1,
          isLast: index === childArray.length - 1,
        }),
      )}
    </div>
  );
}

export function Step({
  title,
  stepNumber,
  isLast,
  children,
}: {
  title?: string;
  stepNumber?: number;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pl-10">
      {/* Numbered circle */}
      <div className="absolute left-0 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.08] dark:bg-white/[0.1]">
        <span className="text-xs font-medium text-black/70 dark:text-white/70">
          {stepNumber}
        </span>
      </div>
      {/* Connecting line */}
      {!isLast && (
        <div className="absolute bottom-0 left-[13px] top-8 w-[2px] bg-black/[0.08] dark:bg-white/[0.08]" />
      )}
      {/* Content */}
      <div className={isLast ? "" : "pb-8"}>
        {title && (
          <h3 className="!mt-0 mb-2 text-[15px] font-semibold text-black/80 dark:text-white/80">
            {title}
          </h3>
        )}
        <div className="text-sm text-black/60 dark:text-white/60 [&>p:last-child]:mb-0">
          {children}
        </div>
      </div>
    </div>
  );
}
