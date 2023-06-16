import React, { useCallback } from "react";
import { useCombobox } from "downshift";
import styled from "styled-components";
import {
  buttonColor,
  defaultBorderRadius,
  secondaryDark,
  vscBackground,
} from ".";

const mainInputFontSize = 16;
const MainTextInput = styled.input`
  padding: 8px;
  font-size: ${mainInputFontSize}px;
  border-radius: ${defaultBorderRadius};
  border: 1px solid #ccc;
  margin: 8px auto;
  width: 100%;
  background-color: ${vscBackground};
  color: white;
  outline: 1px solid orange;
`;

const UlMaxHeight = 200;
const Ul = styled.ul<{
  hidden: boolean;
  showAbove: boolean;
  ulHeightPixels: number;
}>`
  ${(props) =>
    props.showAbove
      ? `transform: translateY(-${props.ulHeightPixels + 8}px);`
      : `transform: translateY(${2 * mainInputFontSize}px);`}
  position: absolute;
  background: ${vscBackground};
  background-color: ${secondaryDark};
  color: white;
  font-family: "Fira Code", monospace;
  max-height: ${UlMaxHeight}px;
  overflow: scroll;
  padding: 0;
  ${({ hidden }) => hidden && "display: none;"}
  border-radius: ${defaultBorderRadius};
  overflow: hidden;
  border: 0.5px solid gray;
`;

const Li = styled.li<{
  highlighted: boolean;
  selected: boolean;
  isLastItem: boolean;
}>`
  ${({ highlighted }) => highlighted && "background: #aa0000;"}
  ${({ selected }) => selected && "font-weight: bold;"}
    padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  ${({ isLastItem }) => isLastItem && "border-bottom: 1px solid gray;"}
  border-top: 1px solid gray;
  cursor: pointer;
`;

interface ComboBoxProps {
  items: { name: string; description: string }[];
  onInputValueChange: (inputValue: string) => void;
  disabled?: boolean;
  onEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const ComboBox = React.forwardRef((props: ComboBoxProps, ref) => {
  const [items, setItems] = React.useState(props.items);
  const {
    isOpen,
    getToggleButtonProps,
    getLabelProps,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    selectedItem,
    setInputValue,
  } = useCombobox({
    onInputValueChange({ inputValue }) {
      if (!inputValue) return;
      props.onInputValueChange(inputValue);
      setItems(
        props.items.filter((item) =>
          item.name.toLowerCase().startsWith(inputValue.toLowerCase())
        )
      );
    },
    items,
    itemToString(item) {
      return item ? item.name : "";
    },
  });

  const divRef = React.useRef<HTMLDivElement>(null);
  const ulRef = React.useRef<HTMLUListElement>(null);
  const showAbove = () => {
    return (divRef.current?.getBoundingClientRect().top || 0) > UlMaxHeight;
  };

  return (
    <div className="flex px-2" ref={divRef} hidden={!isOpen}>
      <MainTextInput
        disabled={props.disabled}
        placeholder="Type '/' to see the list of available slash commands..."
        {...getInputProps({
          onKeyDown: (event) => {
            if (event.key === "Enter" && (!isOpen || items.length === 0)) {
              // Prevent Downshift's default 'Enter' behavior.
              (event.nativeEvent as any).preventDownshiftDefault = true;
              if (props.onEnter) props.onEnter(event);
              setInputValue("");
            } else if (event.key === "Tab" && items.length > 0) {
              setInputValue(items[0].name);
              event.preventDefault();
            }
          },
          ref: ref as any,
        })}
      />
      <Ul
        {...getMenuProps({
          ref: ulRef,
        })}
        showAbove={showAbove()}
        ulHeightPixels={ulRef.current?.getBoundingClientRect().height || 0}
      >
        {isOpen &&
          items.map((item, index) => (
            <Li
              key={`${item.name}${index}`}
              {...getItemProps({ item, index })}
              highlighted={highlightedIndex === index}
              selected={selectedItem === item}
            >
              <span>
                {item.name}: {item.description}
              </span>
            </Li>
          ))}
      </Ul>
    </div>
  );
});

export default ComboBox;
