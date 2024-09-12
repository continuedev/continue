import { useDispatch } from "react-redux";
import {
  setShowDialog,
  setDialogMessage,
} from "../../../redux/slices/uiStateSlice";
import Alert from "../../gui/Alert";
import AddModelForm from "../../../forms/AddModelForm";
import { useSubmitOnboarding } from "../hooks";

function ProviderAlert() {
  const dispatch = useDispatch();
  const { submitOnboarding } = useSubmitOnboarding("Custom");

  function onClick() {
    dispatch(setShowDialog(true));
    dispatch(setDialogMessage(<AddModelForm onDone={submitOnboarding} />));
  }

  return (
    <div className="max-xs:hidden">
      <Alert type="info">
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
    </div>
  );
}

export default ProviderAlert;
