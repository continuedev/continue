import {
  createRuleMarkdown,
  getRuleType,
  RuleType,
  RuleTypeDescriptions,
} from "@continuedev/config-yaml";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { createRuleFilePath } from "core/config/markdown/utils";
import { CreateRuleBlockArgs } from "core/tools/implementations/createRuleBlock";
import { useContext, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import Spinner from "../gui/Spinner";
import { ToolTip } from "../gui/Tooltip";
import { Button } from "../ui";
import { useRuleGeneration } from "./useRuleGeneration";

interface GenerationScreenProps {
  inputPrompt: string;
  onBack: () => void;
  onSuccess: () => void;
  isManualMode?: boolean;
}

export function GenerationScreen({
  inputPrompt,
  onBack,
  onSuccess,
  isManualMode = false,
}: GenerationScreenProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  const { register, watch, setValue, reset } = useForm<CreateRuleBlockArgs>({
    defaultValues: {
      name: "",
      description: "",
      globs: "",
      alwaysApply: true,
      rule: "",
    },
  });

  const formData = watch();

  // Track rule type separately from form data
  const [selectedRuleType, setSelectedRuleType] = useState<RuleType>(
    RuleType.Always,
  );

  // Use the generation hook with the input prompt
  const { generateRule, isGenerating, error, createRuleBlockArgs } =
    useRuleGeneration(inputPrompt, (args) => {
      // Only update form if it's empty (first time generation)
      if (!formData.rule) {
        reset(args);
        handleRuleTypeChange(getRuleType(args));
      }
    });

  // Start generation once when component mounts (only if not in manual mode)
  useEffect(() => {
    if (!isManualMode) {
      void generateRule();
    }
  }, [isManualMode]);

  const handleRuleTypeChange = (newRuleType: RuleType) => {
    setSelectedRuleType(newRuleType);

    // Update alwaysApply based on rule type (false only for Agent Requested)
    const alwaysApply = newRuleType !== RuleType.AgentRequested;
    setValue("alwaysApply", alwaysApply);

    // Clear optional fields when switching types
    if (newRuleType !== RuleType.AgentRequested) {
      setValue("description", "");
    }
    if (newRuleType !== RuleType.AutoAttached) {
      setValue("globs", "");
    }
  };

  const handleContinue = async () => {
    if (!formData.name) {
      console.error("Rule name is required");
      return;
    }

    if (!formData.rule) {
      console.error("Rule content is required");
      return;
    }

    try {
      const options: any = {
        alwaysApply: formData.alwaysApply,
      };

      if (formData.description) {
        options.description = formData.description;
      }

      if (formData.globs) {
        options.globs = formData.globs;
      }

      const fileContent = createRuleMarkdown(
        formData.name,
        formData.rule,
        options,
      );

      const workspaceDirs = await ideMessenger.request(
        "getWorkspaceDirs",
        undefined,
      );

      if (workspaceDirs.status !== "success") {
        return;
      }

      const localContinueDir = workspaceDirs.content[0];
      const ruleFilePath = createRuleFilePath(localContinueDir, formData.name);

      await ideMessenger.request("writeFile", {
        path: ruleFilePath,
        contents: fileContent,
      });
      ideMessenger.post("openFile", { path: ruleFilePath });

      onSuccess();
    } catch (err) {
      console.error("Failed to create rule file:", err);
    }
  };

  const showNameSpinner = isGenerating && !formData.name && !isManualMode;
  const tooltipId = "rule-type-tooltip";

  return (
    <div className="px-2 pb-2 pt-4 sm:px-4">
      <div>
        <div className="text-center">
          <h2 className="mb-0">Your rule</h2>
          <p className="text-description m-0 mt-2 p-0">
            Review and edit your generated rule below
          </p>
        </div>
        <div className="mt-5">
          <div className="flex flex-col gap-4">
            {/* Rule metadata form */}
            <div className="space-y-4">
              {/* Rule Name - Always visible */}
              <div className="space-y-1">
                <label className="text-foreground text-sm font-medium">
                  Rule Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="border-input-border bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus box-border w-full rounded-md border px-3 py-2 text-xs focus:outline-none"
                    placeholder={showNameSpinner ? "" : "Enter rule name..."}
                    disabled={isGenerating && !isManualMode}
                    {...register("name")}
                  />
                  {showNameSpinner && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Spinner />
                    </div>
                  )}
                </div>
              </div>

              {/* Rule Type Selector - Always visible */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-foreground text-sm font-medium">
                    Rule Type
                  </label>
                  <InformationCircleIcon
                    data-tooltip-id={tooltipId}
                    data-tooltip-content={
                      RuleTypeDescriptions[selectedRuleType]
                    }
                    className="h-4 w-4 text-gray-500"
                  />
                  <ToolTip id={tooltipId} style={{ zIndex: 100001 }} />
                </div>
                <div className="relative">
                  <select
                    className="border-input-border bg-input text-input-foreground focus:border-border-focus w-full rounded-md border px-3 py-2 text-xs focus:outline-none"
                    value={isGenerating ? "" : selectedRuleType}
                    onChange={(e) =>
                      handleRuleTypeChange(e.target.value as RuleType)
                    }
                    disabled={isGenerating && !isManualMode}
                  >
                    {isGenerating && !isManualMode ? (
                      <option value=""></option>
                    ) : (
                      <>
                        <option value={RuleType.Always}>Always</option>
                        <option value={RuleType.AutoAttached}>
                          Auto Attached
                        </option>
                        <option value={RuleType.AgentRequested}>
                          Agent Requested
                        </option>
                        <option value={RuleType.Manual}>Manual</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Description (for Agent Requested only) */}
              {selectedRuleType === RuleType.AgentRequested && (
                <div className="space-y-1">
                  <label className="text-foreground text-sm font-medium">
                    Description
                  </label>
                  <textarea
                    className="border-input-border bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus box-border w-full resize-none rounded-md border px-3 py-2 text-xs focus:outline-none"
                    rows={3}
                    placeholder="Description of the task this rule is helpful for..."
                    {...register("description")}
                  />
                </div>
              )}

              {/* File Pattern (for Auto Attached only) */}
              {selectedRuleType === RuleType.AutoAttached && (
                <div className="space-y-1">
                  <label className="text-foreground text-sm font-medium">
                    File pattern matches
                  </label>
                  <input
                    type="text"
                    className="border-input-border bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus box-border w-full rounded-md border px-3 py-2 font-mono text-xs focus:outline-none"
                    placeholder="*.tsx, **/*.{ts,tsx}, tests/**/*.ts ..."
                    {...register("globs")}
                  />
                </div>
              )}
            </div>

            {/* Rule Content */}
            <div className="relative">
              <label className="text-foreground text-sm font-medium">
                Rule Content
              </label>
              <textarea
                className="border-input-border bg-input text-input-foreground placeholder:text-input-placeholder focus:border-border-focus mt-1 box-border w-full resize-none rounded border p-2 text-xs focus:outline-none"
                rows={10}
                disabled={isGenerating && !isManualMode}
                placeholder="Your rule content..."
                {...register("rule")}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex flex-row justify-center gap-5">
              <Button
                type="button"
                className="min-w-16"
                onClick={onBack}
                variant="outline"
                disabled={isGenerating && !isManualMode}
              >
                Back
              </Button>
              <Button
                className="min-w-16"
                onClick={handleContinue}
                disabled={
                  (isGenerating && !isManualMode) ||
                  (!formData.rule && !error) ||
                  !formData.name
                }
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
