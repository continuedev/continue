import { ReactNode } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { lightGray } from "../..";

interface CheckMarkHeaderProps {
  isComplete: boolean;
  isOptional?: boolean;
  children: ReactNode;
}

export function CheckMarkHeader({
  isComplete,
  isOptional,
  children,
}: CheckMarkHeaderProps) {
  return (
    <div className="flex gap-4 items-center">
      {isComplete ? (
        <CheckCircleIcon
          width="24px"
          height="24px"
          color="#0b0"
          className="flex-none"
        ></CheckCircleIcon>
      ) : (
        <div
          className="flex-none border border-solid rounded-full w-5 h-5 mt-1"
          style={{ borderColor: lightGray }}
        ></div>
      )}

      <div className={`flex flex-col ${isOptional ? "mb-3" : ""}`}>
        <h3 className={`${isOptional ? "mb-1" : ""}`}>{children}</h3>
        {isOptional && <i>Optional</i>}
      </div>
    </div>
  );
}
