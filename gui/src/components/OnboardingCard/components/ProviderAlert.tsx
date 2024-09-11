import { useDispatch } from "react-redux";
import {
  setShowDialog,
  setDialogMessage,
} from "../../../redux/slices/uiStateSlice";
import Alert from "../../gui/Alert";
import AddModelForm from "../../../forms/AddModelForm";
import { useCompleteOnboarding } from "../utils";

function ProviderAlert() {
  const dispatch = useDispatch();
  const { completeOnboarding } = useCompleteOnboarding();

  function onClick() {
    dispatch(setShowDialog(true));
    dispatch(setDialogMessage(<AddModelForm onDone={completeOnboarding} />));
  }

  return (
    <Alert>
      <p className="font-semibold text-sm m-0">
        Prefer to use an different provider like OpenAI?
      </p>
      <p className="m-0 mt-1">
        <a
          className="text-inherit underline cursor-pointer hover:text-inherit"
          onClick={onClick}
        >
          Click here
        </a>{" "}
        to add a Chat model from OpenAI, Gemini, and more
      </p>
    </Alert>
  );
}

export default ProviderAlert;
