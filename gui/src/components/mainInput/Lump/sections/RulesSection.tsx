import { parseConfigYaml } from "@continuedev/config-yaml";
import {
  ArrowsPointingOutIcon,
  EyeIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { RuleWithSource } from "core";
import {
  DEFAULT_AGENT_SYSTEM_MESSAGE,
  DEFAULT_CHAT_SYSTEM_MESSAGE,
  DEFAULT_SYSTEM_MESSAGES_URL,
} from "core/llm/defaultSystemMessages";
import { useContext, useMemo } from "react";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import {
  DEFAULT_RULE_SETTING,
  setDialogMessage,
  setShowDialog,
  toggleRuleSetting,
} from "../../../../redux/slices/uiSlice";
import HeaderButtonWithToolTip from "../../../gui/HeaderButtonWithToolTip";
import Switch from "../../../gui/Switch";
import { useFontSize } from "../../../ui/font";
import { ExploreBlocksButton } from "./ExploreBlocksButton";

interface RuleCardProps {
  rule: RuleWithSource;
}

const RuleCard: React.FC<RuleCardProps> = ({ rule }) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const mode = useAppSelector((store) => store.session.mode);
  const policy = useAppSelector((state) =>
    rule.name
      ? state.ui.ruleSettings[rule.name] || DEFAULT_RULE_SETTING
      : undefined,
  );

  const isDisabled = policy === "off";

  const handleOpen = async () => {
    if (rule.slug) {
      void ideMessenger.request("controlPlane/openUrl", {
        path: `${rule.slug}/new-version`,
        orgSlug: undefined,
      });
    } else if (rule.ruleFile) {
      ideMessenger.post("openFile", {
        path: rule.ruleFile,
      });
    } else if (
      rule.source === "default-chat" ||
      rule.source === "default-plan" ||
      rule.source === "default-agent"
    ) {
      ideMessenger.post("openUrl", DEFAULT_SYSTEM_MESSAGES_URL);
    } else {
      ideMessenger.post("config/openProfile", {
        profileId: undefined,
        element: { sourceFile: (rule as any).sourceFile },
      });
    }
  };

  const handleTogglePolicy = () => {
    if (rule.name) {
      dispatch(toggleRuleSetting(rule.name));
    }
  };

  const title = useMemo(() => {
    if (rule.name) {
      return rule.name;
    } else {
      if (rule.source === ".continuerules") {
        return "Project rules";
      } else if (rule.source === "default-chat") {
        return "Default chat system message";
      } else if (rule.source === "default-agent") {
        return "Default agent system message";
      } else if (rule.source === "json-systemMessage") {
        return "JSON systemMessage)";
      } else if (rule.source === "model-options-agent") {
        return "Base System Agent Message";
      } else if (rule.source === "model-options-plan") {
        return "Base System Plan Message";
      } else if (rule.source === "model-options-chat") {
        return "Base System Chat Message";
      } else {
        return "Assistant rule";
      }
    }
  }, [rule]);

  function onClickExpand() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <div className="max-h-4/5 p-4">
          <h3>{title}</h3>
          <pre className="max-w-full overflow-scroll">{rule.rule}</pre>
        </div>,
      ),
    );
  }

  const smallFont = useFontSize(-2);
  const tinyFont = useFontSize(-3);
  return (
    <div
      className={`border-border flex flex-col rounded-sm px-2 py-1.5 transition-colors ${isDisabled ? "opacity-50" : ""}`}
    >
      <div className="flex flex-col">
        <div className="flex flex-row justify-between gap-1">
          <span
            className={`line-clamp-2 ${isDisabled ? "text-gray-400" : "text-vsc-foreground"}`}
            style={{
              fontSize: smallFont,
            }}
          >
            {title}
          </span>
          <div className="flex flex-row items-center gap-2">
            {rule.name && policy && (
              <div className="flex cursor-pointer flex-row items-center justify-end gap-1 px-2 py-0.5">
                <Switch
                  isToggled={policy === "on"}
                  onToggle={() => handleTogglePolicy()}
                  size={10}
                  text=""
                />
              </div>
            )}
            <div className="flex flex-row items-start gap-1">
              <HeaderButtonWithToolTip onClick={onClickExpand} text="Expand">
                <ArrowsPointingOutIcon className="h-3 w-3 text-gray-400" />
              </HeaderButtonWithToolTip>{" "}
              {rule.source === "default-chat" ||
              rule.source === "default-agent" ? (
                <HeaderButtonWithToolTip onClick={handleOpen} text="View">
                  <EyeIcon className="h-3 w-3 text-gray-400" />
                </HeaderButtonWithToolTip>
              ) : (
                <HeaderButtonWithToolTip onClick={handleOpen} text="Edit">
                  <PencilIcon className="h-3 w-3 text-gray-400" />
                </HeaderButtonWithToolTip>
              )}
            </div>
          </div>
        </div>

        <span
          style={{
            fontSize: tinyFont,
          }}
          className={`mt-1 line-clamp-3 ${isDisabled ? "text-gray-500" : "text-gray-400"}`}
        >
          {rule.rule}
        </span>
        {rule.globs ? (
          <div
            style={{
              fontSize: tinyFont,
            }}
            className="mt-1.5 flex flex-col gap-1"
          >
            <span className="italic">Applies to files</span>
            <code
              className={`line-clamp-1 px-1 py-0.5 ${isDisabled ? "text-gray-500" : "text-gray-400"}`}
            >
              {rule.globs}
            </code>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export function RulesSection() {
  const { selectedProfile } = useAuth();
  const config = useAppSelector((store) => store.config.config);
  const mode = useAppSelector((store) => store.session.mode);
  const sortedRules: RuleWithSource[] = useMemo(() => {
    const rules = [...config.rules.map((rule) => ({ ...rule }))];

    // Use profile rawYaml to infer slugs
    if (selectedProfile?.rawYaml) {
      try {
        const parsed = parseConfigYaml(selectedProfile.rawYaml);
        const parsedRules = parsed?.rules ?? [];
        let index = 0;
        for (const rule of rules) {
          if (rule.source === "rules-block") {
            let slug: string | undefined = undefined;
            const yamlRule = parsedRules[index];
            if (yamlRule) {
              if (typeof yamlRule !== "string" && "uses" in yamlRule) {
                slug = yamlRule.uses;
              } else {
                slug = `${selectedProfile?.fullSlug.ownerSlug}/${selectedProfile?.fullSlug.packageSlug}`;
              }
            }
            if (slug) {
              rule.slug = slug;
            }

            index++;
          }
        }
      } catch (e) {
        console.error(
          "Rules notch section: failed to parse selected profile",
          e,
        );
      }
    }

    if (mode === "chat") {
      if (config.selectedModelByRole.chat?.baseChatSystemMessage) {
        rules.unshift({
          rule: config.selectedModelByRole.chat?.baseChatSystemMessage,
          source: "model-options-chat",
        });
      } else {
        rules.unshift({
          rule: DEFAULT_CHAT_SYSTEM_MESSAGE,
          source: "default-chat",
        });
      }
    } else if (mode === "agent") {
      // agent
      if (config.selectedModelByRole.chat?.baseAgentSystemMessage) {
        rules.unshift({
          rule: config.selectedModelByRole.chat?.baseAgentSystemMessage,
          source: "model-options-agent",
        });
      } else {
        rules.unshift({
          rule: DEFAULT_AGENT_SYSTEM_MESSAGE,
          source: "default-agent",
        });
      }
    } else {
      // plan
      if (config.selectedModelByRole.chat?.basePlanSystemMessage) {
        rules.unshift({
          rule: config.selectedModelByRole.chat?.basePlanSystemMessage,
          source: "model-options-plan",
        });
      } else {
        rules.unshift({
          rule: DEFAULT_AGENT_SYSTEM_MESSAGE,
          source: "default-agent",
        });
      }
    }

    return rules;
  }, [config, selectedProfile, mode]);

  return (
    <div className="flex flex-col gap-3">
      {sortedRules.map((rule, index) => (
        <RuleCard key={index} rule={rule} />
      ))}
      <ExploreBlocksButton blockType="rules" />
    </div>
  );
}
