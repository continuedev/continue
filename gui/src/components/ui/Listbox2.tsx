// import { ChevronDownIcon } from "@heroicons/react/24/outline";
// import React, {
//   ButtonHTMLAttributes,
//   LiHTMLAttributes,
//   useEffect,
//   useRef,
//   useState,
// } from "react";

// import { cn } from "../../util/cn";

// import { createContext, useContext } from 'react';

// interface ListboxContextType {

// };

// const defaultListboxContext: ListboxContextType = {

// }

// export const ListboxContext = createContext<ListboxContextType>(defaultListboxContext);

// const useListbox = () => {
//   const context = useContext(ThemeContext);
//   if (context === undefined) {
//     throw new Error('useTheme must be used within a ThemeProvider');
//   }
//   return context;
// };

// interface ListboxItemProps extends LiHTMLAttributes<HTMLLIElement> {
//   isOpen: boolean;
//   // selected: boolean
// }

// export const ListboxItem: React.FC<ListboxItemProps> = (props) => {
//   return <li {...props} className={cn(props.className, "")} />;
// };

// interface ListboxButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
//   isOpen: boolean;
//   showChevron: boolean;
// }

// export const ListboxButton: React.FC<ListboxButtonProps> = (props) => {
//   return (
//     <button
//       className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2"
//       //   onClick={toggleList}
//       {...props}
//     >
//       {props.children}
//       {props.showChevron ? (
//         <ChevronDownIcon
//           className={`h-3 w-3 flex-shrink-0 transform duration-200 ease-in-out ${
//             props.isOpen ? "rotate-180" : ""
//           }`}
//         />
//       ) : null}
//     </button>
//   );
// };

// export const ContinueListbox: React.FC<ListBoxProps> = ({
//   options,
//   value,
//   onChange,
//   placeholder,
// }) => {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const listRef = useRef<HTMLUListElement>(null);

//   return (
//     <div className="relative w-48" ref={containerRef}>
//       <ul
//         ref={listRef}
//         role="listbox"
//         className={`absolute w-full rounded-md border border-gray-300 bg-white py-0 shadow-lg ${isOpen ? "visible scale-100 opacity-100" : "invisible scale-y-75 opacity-0"} ${popupDirection === "up" ? "bottom-full origin-bottom" : "top-full origin-top"} mb-1 mt-1 max-h-[200px] overflow-y-auto transition-all duration-200 ease-in-out`}
//       >
//         {options.map((option) => (
//           <li
//             key={option}
//             role="option"
//             aria-selected={option === value}
//             onClick={() => {
//               onChange?.(option);
//               setIsOpen(false);
//             }}
//             className={`cursor-pointer list-none px-3 py-2 hover:bg-gray-100 ${option === value ? "bg-gray-200" : ""}`}
//           >
//             {option}
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// };

// // interface UseListboxProps
// function useListbox<T>() {
//   const listRef = useRef<HTMLUListElement>(null);
//   const containerRef = useRef<HTMLDivElement>(null);
//   const buttonRef = useRef<HTMLButtonElement>(null);

//   const [isOpen, setIsOpen] = useState(false);
//   const [popupDirection, setPopupDirection] = useState<"down" | "up">("down");

//   useEffect(() => {
//     if (isOpen && containerRef.current && listRef.current) {
//       const rect = containerRef.current.getBoundingClientRect();
//       const listHeight = listRef.current.offsetHeight;
//       const viewportHeight = window.innerHeight;
//       const spaceBelow = viewportHeight - rect.bottom;
//       const spaceAbove = rect.top;
//       setPopupDirection(
//         spaceBelow >= listHeight || spaceBelow >= spaceAbove ? "down" : "up",
//       );
//     }
//   }, [isOpen]);

//   // Handle blurring/clicking outside the list

//   useEffect(() => {
//     if (!listRef.current) return;
//     const ref = listRef.current;
//     const handleBlur = () => setIsOpen(false);
//     ref.addEventListener("blur", handleBlur);
//     return () => ref.removeEventListener("blur", handleBlur);
//   }, [listRef]);

//   function closeList() {
//     setIsOpen(false);
//   }

//   function openList() {
//     setIsOpen(true);
//     listRef.current?.focus();
//   }

//   function toggleList() {
//     if (isOpen) {
//       closeList();
//     } else {
//       openList();
//     }
//   }

//   return {
//     listRef,
//     containerRef,
//     buttonRef,
//     isOpen,
//     closeList,
//     openList,
//     toggleList,
//   };
// }

// const options = ["Apple", "Banana", "Orange", "Mango", "Pineapple"];
// export const ExampleListbox = () => {
//   return (
//     <ContinueListbox
//       options={options}
//       placeholder="Select a fruit"
//       onChange={(value) => console.log("Selected:", value)}
//     />
//   );
// };
