import { useDispatch } from "react-redux";
import styled from "styled-components";
import { Button, lightGray, SecondaryButton } from "..";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 8px;
  align-items: center;

  > * {
    grid-column: 2;
  }

  > :nth-last-child(2):first-child {
    grid-column: 1;
  }
`;

interface ConfirmationDialogProps {
  onConfirm: () => void;
  onCancel?: () => void;
  text: string;
  title?: string;
  hideCancelButton?: boolean;
  confirmText?: string;
}

function ConfirmationDialog(props: ConfirmationDialogProps) {
  const dispatch = useDispatch();

  return (
    <div className="p-4">
      <h3>{props.title ?? "Confirmation"}</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{props.text}</p>

      <GridDiv>
        {!!props.hideCancelButton || (
          <SecondaryButton
            style={{ color: lightGray }}
            onClick={() => {
              props.onCancel?.();
              dispatch(setShowDialog(false));
              dispatch(setDialogMessage(undefined));
            }}
          >
            Cancel
          </SecondaryButton>
        )}
        <Button
          onClick={() => {
            props.onConfirm();
            dispatch(setShowDialog(false));
            dispatch(setDialogMessage(undefined));
          }}
        >
          {props.confirmText ?? "Confirm"}
        </Button>
      </GridDiv>
    </div>
  );
}

export default ConfirmationDialog;
