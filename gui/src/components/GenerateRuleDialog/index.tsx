import { useContext, useState } from "react";
import { useDispatch } from "react-redux";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { Button } from "../ui";
import { RuleTemplateChip } from "./RuleTemplateChip";
import { RuleTemplate, ruleTemplates } from "./ruleTemplates";

function GenerateRuleDialog() {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const [textareaValue, setTextareaValue] = useState("");

  const lastChatMessage = useAppSelector(
    (state) => state.session.history[state.session.history.length - 1],
  );

  const closeDialog = () => {
    dispatch(setDialogMessage(undefined));
    dispatch(setShowDialog(false));
  };

  function onSubmit(e: any) {
    e.preventDefault();
    // Logic to generate rule will go here
    closeDialog();
  }

  function handleRuleTemplateClick(ruleTemplate: RuleTemplate) {
    setTextareaValue(ruleTemplate.template);
  }

  return (
    <div className="px-2 pb-2 pt-4 sm:px-4">
      <div>
        <div className="text-center">
          <h2 className="mb-0">Generate Rule</h2>
          <p className="text-description m-0 mt-2 p-0">
            This will generate a new rule using the content of your chat history
          </p>
        </div>
        <div className="mt-5">
          <form onSubmit={onSubmit} className="flex flex-col gap-1">
            <div className="flex flex-col gap-2">
              <textarea
                className="border-input-border bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus min-w-0 max-w-full resize-none rounded border p-2 text-sm text-xs focus:outline-none"
                placeholder="Describe your rule..."
                rows={4}
                value={textareaValue}
                onChange={(e) => setTextareaValue(e.target.value)}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {ruleTemplates.map((template, index) => (
                <RuleTemplateChip
                  key={index}
                  icon={template.icon}
                  text={template.title}
                  onClick={() => handleRuleTemplateClick(template)}
                />
              ))}
            </div>

            <div className="mt-4 flex flex-row justify-center gap-5">
              <Button
                type="button"
                className="min-w-16"
                onClick={closeDialog}
                variant="outline"
              >
                Cancel
              </Button>
              <Button className="min-w-16">Generate</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default GenerateRuleDialog;
