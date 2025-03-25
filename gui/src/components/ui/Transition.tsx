import { Transition as HLTransition } from "@headlessui/react";
import { cn } from "../../util/cn";

type TransitionProps = React.ComponentProps<typeof HLTransition>;
function Transition(props: TransitionProps) {
  return (
    <HLTransition
      enter="transition duration-100 ease-out"
      enterFrom="transform scale-95 opacity-0"
      enterTo="transform scale-100 opacity-100"
      leave="transition duration-75 ease-out"
      leaveFrom="transform scale-100 opacity-100"
      leaveTo="transform scale-95 opacity-0"
      {...props}
      className={cn("flex flex-col", props.className)}
    />
  );
}

export { Transition };
