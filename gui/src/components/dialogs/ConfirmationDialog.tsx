import { useDispatch } from "react-redux";
import styled from "styled-components";
import { Button } from "..";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 8px;
  align-items: center;
`;

interface ConfirmationDialogProps {
  onConfirm: () => void;
  onCancel?: () => void;
  text: string;
}

function ConfirmationDialog(props: ConfirmationDialogProps) {
  const dispatch = useDispatch();

  return (
    <div className="p-4">
      <h3>Confirmation</h3>
      <p>{props.text}</p>

      <GridDiv>
        <Button
          onClick={() => {
            props.onCancel?.();
            dispatch(setShowDialog(false));
            dispatch(setDialogMessage(undefined));
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            props.onConfirm();
            dispatch(setShowDialog(false));
            dispatch(setDialogMessage(undefined));
          }}
        >
          Confirm
        </Button>
      </GridDiv>
    </div>
  );
}

export default ConfirmationDialog;
