import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { lightGray } from "../..";

interface CheckMarkHeaderProps {
  isComplete: boolean;
  title: string;
}

export function CheckMarkHeader({ isComplete, title }: CheckMarkHeaderProps) {
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
          className="flex-none border border-solid rounded-full w-5 h-5"
          style={{ borderColor: lightGray }}
        ></div>
      )}

      <h2 className="text-base">{title}</h2>
    </div>
  );
}
