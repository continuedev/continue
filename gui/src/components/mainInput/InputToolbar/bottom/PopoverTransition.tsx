import { Transition } from "@headlessui/react";

export default function PopoverTransition({
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
      enterFrom="transform scale-95 opacity-0"
      enterTo="transform scale-100 opacity-100"
      leave="transition duration-75 ease-out"
      leaveFrom="transform scale-100 opacity-100"
      leaveTo="transform scale-95 opacity-0"
      afterLeave={afterLeave}
    >
      {children}
    </Transition>
  );
}
