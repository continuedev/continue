import { useDispatch } from "react-redux";
import {
  setShowDialog,
  setDialogMessage,
} from "../../../redux/slices/uiStateSlice";
import Alert from "../../gui/Alert";
import AddModelForm from "../../../forms/AddModelForm";
import { OnboardingTab } from "../tabs/types";

function AlternativeProviderAlert({ onComplete }: OnboardingTab) {
  const dispatch = useDispatch();

  function onOtherProviderClick() {
    dispatch(setShowDialog(true));
    dispatch(setDialogMessage(<AddModelForm onDone={onComplete} />));
  }

  return (
    <Alert>
      <p className="font-semibold text-sm m-0">
        Prefer to use an alternative provider like OpenAI?
      </p>
      <p className="m-0 mt-1">
        <a
          className="text-inherit underline cursor-pointer hover:text-inherit"
          onClick={onOtherProviderClick}
        >
          Click here
        </a>{" "}
        to add a Chat model
      </p>
    </Alert>
  );
}

export default AlternativeProviderAlert;
