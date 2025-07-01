import { useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { GenerationScreen } from "./GenerationScreen";
import { InputScreen } from "./InputScreen";
import { RuleTemplate } from "./ruleTemplates";
import { useRuleGeneration } from "./useRuleGeneration";

type Screen = "input" | "generation";

export function GenerateRuleDialog() {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const [screen, setScreen] = useState<Screen>("input");
  const [inputPrompt, setInputPrompt] = useState("");

  const { generateRule, generatedContent, isGenerating, error, reset } =
    useRuleGeneration();

  const showDialog = useAppSelector((state) => state.ui.showDialog);

  const lastChatMessage = useAppSelector(
    (state) => state.session.history[state.session.history.length - 1],
  );

  // Reset dialog state when it closes (handles outside clicks and X button)
  useEffect(() => {
    if (!showDialog) {
      reset();
      setScreen("input");
      setInputPrompt("");
    }
  }, [showDialog, reset]);

  const closeDialog = () => {
    reset();
    setScreen("input");
    setInputPrompt("");
    dispatch(setDialogMessage(undefined));
    dispatch(setShowDialog(false));
  };

  const handleGenerate = async (prompt: string) => {
    setInputPrompt(prompt);
    setScreen("generation");
    await generateRule(prompt);
  };

  const handleBack = () => {
    reset();
    setScreen("input");
  };

  const handleContinue = () => {
    // TODO: This will handle saving the generated rule
    closeDialog();
  };

  const handleRuleTemplateClick = (ruleTemplate: RuleTemplate) => {
    setInputPrompt(ruleTemplate.template);
  };

  if (screen === "input") {
    return (
      <InputScreen
        inputPrompt={inputPrompt}
        setInputPrompt={setInputPrompt}
        onGenerate={handleGenerate}
        onCancel={closeDialog}
        onRuleTemplateClick={handleRuleTemplateClick}
      />
    );
  }

  return (
    <GenerationScreen
      generatedContent={generatedContent}
      isGenerating={isGenerating}
      error={error}
      onBack={handleBack}
      onContinue={handleContinue}
    />
  );
}
