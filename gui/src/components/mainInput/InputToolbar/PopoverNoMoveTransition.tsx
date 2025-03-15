import { Transition } from "@headlessui/react";

export default function PopoverNoMoveTransition({
  children,
  show,
  afterLeave,
}: {
  children: React.ReactNode;
  show?: boolean;
  afterLeave?: () => void;
}) {
  return (
    <Transition
      show={show}
      enter="transition duration-100 ease-out"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition duration-75 ease-out"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      afterLeave={afterLeave}
    >
      {children}
    </Transition>
  );
}
