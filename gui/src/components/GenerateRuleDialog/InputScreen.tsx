import React from "react";
import { Button } from "../ui";
import { RuleTemplateChip } from "./RuleTemplateChip";
import { RuleTemplate, ruleTemplates } from "./ruleTemplates";

interface InputScreenProps {
  inputPrompt: string;
  onInputChange: (prompt: string) => void;
  onGenerate: (prompt: string) => void;
  onCancel: () => void;
  onManualWrite: () => void;
}

export function InputScreen({
  inputPrompt,
  onInputChange,
  onGenerate,
  onCancel,
  onManualWrite,
}: InputScreenProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputPrompt.trim()) {
      return;
    }

    onGenerate(inputPrompt);
  };

  const handleRuleTemplateClick = (template: RuleTemplate) => {
    onInputChange(template.template);
  };

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
          <form onSubmit={handleSubmit} className="flex flex-col gap-1">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-x-3">
              {ruleTemplates.map((template, index) => (
                <RuleTemplateChip
                  key={index}
                  icon={template.icon}
                  text={template.title}
                  onClick={() => handleRuleTemplateClick(template)}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <textarea
                className="border-input-border bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus box-border w-full resize-none rounded border p-2 text-xs focus:outline-none"
                placeholder="Describe your rule..."
                rows={5}
                value={inputPrompt}
                onChange={(e) => onInputChange(e.target.value)}
              />
            </div>

            <div className="my-4 flex flex-col items-center gap-2">
              <div className="flex flex-row justify-center gap-3">
                <Button
                  type="button"
                  className="min-w-16"
                  onClick={onCancel}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button className="min-w-16" disabled={!inputPrompt.trim()}>
                  Generate
                </Button>
              </div>
              <span
                className="text-description cursor-pointer text-xs underline"
                onClick={onManualWrite}
              >
                Or, write a rule from scratch
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
