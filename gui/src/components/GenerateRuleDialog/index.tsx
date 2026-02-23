import { useState } from "react";
import { useDispatch } from "react-redux";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { GenerationScreen } from "./GenerationScreen";
import { InputScreen } from "./InputScreen";

type Screen = "input" | "generation";

export function GenerateRuleDialog() {
  const dispatch = useDispatch();
  const [screen, setScreen] = useState<Screen>("input");
  const [inputPrompt, setInputPrompt] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);

  const closeDialog = () => {
    setScreen("input");
    setInputPrompt("");
    setIsManualMode(false);
    dispatch(setDialogMessage(undefined));
    dispatch(setShowDialog(false));
  };

  const handleGenerate = (prompt: string) => {
    setInputPrompt(prompt);
    setIsManualMode(false);
    setScreen("generation");
  };

  const handleManualWrite = () => {
    setIsManualMode(true);
    setScreen("generation");
  };

  const handleBack = () => {
    setScreen("input");
  };

  const handleSuccess = () => {
    closeDialog();
  };

  if (screen === "input") {
    return (
      <InputScreen
        inputPrompt={inputPrompt}
        onInputChange={setInputPrompt}
        onGenerate={handleGenerate}
        onCancel={closeDialog}
        onManualWrite={handleManualWrite}
      />
    );
  }

  return (
    <GenerationScreen
      inputPrompt={inputPrompt}
      onBack={handleBack}
      onSuccess={handleSuccess}
      isManualMode={isManualMode}
    />
  );
}
