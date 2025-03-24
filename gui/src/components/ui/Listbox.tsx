import {
  ListboxButton as HLButton,
  ListboxOption as HLOption,
  ListboxOptions as HLOptions,
  Listbox,
  Transition,
} from "@headlessui/react";
import * as React from "react";
import { useState } from "react";
import { cn } from "../../util/cn";

type ListboxButtonProps = React.ComponentProps<typeof HLButton>;
const ListboxButton = React.forwardRef<HTMLButtonElement, ListboxButtonProps>(
  ({ className, ...props }, ref) => (
    <ListboxButton
      ref={ref}
      className={cn(
        "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);

type ListboxOptionsProps = React.ComponentProps<typeof HLOptions>;
const ListboxOptions = React.forwardRef<HTMLUListElement, ListboxOptionsProps>(
  ({ className, ...props }, ref) => (
    <HLOptions
      ref={ref}
      className={cn(
        "bg-popover text-popover-foreground absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border p-1 shadow-md",
        className,
      )}
      {...props}
    />
  ),
);

type ListboxOptionProps = React.ComponentProps<typeof HLOption>;
const ListboxOption = React.forwardRef<HTMLLIElement, ListboxOptionProps>(
  ({ className, ...props }, ref) => (
    <HLOption
      ref={ref}
      className={cn(
        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors",
        className,
      )}
      {...props}
    />
  ),
);

type ListboxTransitionProps = React.ComponentProps<typeof Transition>;
function ListboxTransition(props: ListboxTransitionProps) {
  return (
    <Transition
      enter="transition duration-100 ease-out"
      enterFrom="transform scale-95 opacity-0"
      enterTo="transform scale-100 opacity-100"
      leave="transition duration-75 ease-out"
      leaveFrom="transform scale-100 opacity-100"
      leaveTo="transform scale-95 opacity-0"
      {...props}
    />
  );
}

const people = [
  { id: 1, name: "Durward Reynolds" },
  { id: 2, name: "Kenton Towne" },
  { id: 3, name: "Therese Wunsch" },
  { id: 4, name: "Benedict Kessler" },
  { id: 5, name: "Katelyn Rohan" },
];

function ExampleListbox() {
  const [selectedPerson, setSelectedPerson] = useState(people[0]);

  return (
    <Listbox value={selectedPerson} onChange={setSelectedPerson}>
      <ListboxButton>{selectedPerson.name}</ListboxButton>
      <ListboxTransition>
        <ListboxOptions anchor="bottom">
          {people.map((person) => (
            <ListboxOption
              key={person.id}
              value={person}
              className="data-[focus]:bg-blue-100"
            >
              {person.name}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </ListboxTransition>
    </Listbox>
  );
}

export {
  ExampleListbox,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
};
