import { lightGray } from "..";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

export function CheckMarkHeader(props: {
  children: string;
  isComplete: boolean;
}) {
  return (
    <div className="flex gap-4 items-center">
      {props.isComplete ? (
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
      <h3>{props.children}</h3>
    </div>
  );
}
