import styled from "styled-components";
import { defaultBorderRadius, lightGray, secondaryDark } from "..";

const StyledDiv = styled.div`
  position: absolute;
  display: flex;
  gap: 4px;
  right: 12px;
  bottom: 4px;
  width: calc(100% - 28px);
  background-color: ${secondaryDark};

  align-items: center;
  z-index: 50;
  font-size: 10px;

  cursor: text;

  & > * {
    flex: 0 0 auto;
  }
`;

const EnterButton = styled.div<{ offFocus: boolean }>`
  padding: 2px 4px;
  display: flex;
  align-items: center;

  background-color: ${(props) =>
    props.offFocus ? undefined : lightGray + "33"};
  border-radius: ${defaultBorderRadius};
  color: #fff8;

  &:hover {
    background-color: #cf313199;
    color: white;
  }

  cursor: pointer;
`;

interface InputToolbarProps {
  onEnter?: () => void;
  useCodebase?: () => void;
  usingCodebase?: boolean;
  onAddContextItem?: () => void;

  hidden?: boolean;
}

function InputToolbar(props: InputToolbarProps) {
  return (
    <StyledDiv hidden={props.hidden}>
      <span
        style={{
          color: lightGray,
        }}
        onClick={(e) => {
          props.onAddContextItem();
        }}
        className="hover:underline cursor-pointer mr-auto"
      >
        + Add Context
      </span>
      <span
        style={{
          color: props.usingCodebase ? "#fff8" : lightGray,
          backgroundColor: props.usingCodebase ? lightGray + "33" : undefined,
          borderRadius: defaultBorderRadius,
          padding: "2px 4px",
        }}
        onClick={props.useCodebase}
        className={"hover:underline cursor-pointer float-right"}
      >
        {/* {downshiftProps.inputValue?.startsWith("/codebase")
      ? "Using Codebase"
      : `${getMetaKeyLabel()} ⏎ Use Codebase`} */}
      </span>

      <EnterButton
        offFocus={props.usingCodebase}
        // disabled={
        //   !active &&
        //   (!(inputRef.current as any)?.value ||
        //     typeof client === "undefined")
        // }
        onClick={props.onEnter}
      >
        ⏎ Enter
      </EnterButton>
    </StyledDiv>
  );
}

export default InputToolbar;
