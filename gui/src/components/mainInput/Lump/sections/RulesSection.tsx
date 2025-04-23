import { parseConfigYaml } from "@continuedev/config-yaml";
import {
  ArrowsPointingOutIcon,
  EyeIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { RuleWithSource } from "core";
import {
  DEFAULT_CHAT_SYSTEM_MESSAGE,
  DEFAULT_CHAT_SYSTEM_MESSAGE_URL,
} from "core/llm/constructMessages";
import { useContext, useMemo } from "react";
import { defaultBorderRadius, vscCommandCenterActiveBorder } from "../../..";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../../redux/slices/uiSlice";
import HeaderButtonWithToolTip from "../../../gui/HeaderButtonWithToolTip";
import { useFontSize } from "../../../ui/font";
import { ExploreBlocksButton } from "./ExploreBlocksButton";

interface RuleCardProps {
  rule: RuleWithSource;
}

const RuleCard: React.FC<RuleCardProps> = ({ rule }) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const handleOpen = async () => {
    if (rule.slug) {
      ideMessenger.request("controlPlane/openUrl", {
        path: `${rule.slug}/new-version`,
        orgSlug: undefined,
      });
    } else if (rule.ruleFile) {
      ideMessenger.post("openFile", {
        path: rule.ruleFile,
      });
    } else if (rule.source === "default") {
      ideMessenger.post("openUrl", DEFAULT_CHAT_SYSTEM_MESSAGE_URL);
    } else {
      ideMessenger.post("config/openProfile", {
        profileId: undefined,
      });
    }
  };

  const title = useMemo(() => {
    if (rule.name) {
      return rule.name;
    } else {
      if (rule.source === ".continuerules") {
        return "Project rules";
      } else if (rule.source === "default") {
        return "Default chat system message";
      } else if (rule.source === "json-systemMessage") {
        return "JSON systemMessage)";
      } else if (rule.source === "model-chat-options") {
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
      style={{
        borderRadius: defaultBorderRadius,
        border: `1px solid ${vscCommandCenterActiveBorder}`,
      }}
      className="flex flex-col px-2 py-1.5 transition-colors"
    >
      <div className="flex flex-col">
        <div className="flex flex-row justify-between gap-1">
          <span
            className="text-vsc-foreground line-clamp-2"
            style={{
              fontSize: smallFont,
            }}
          >
            {title}
          </span>
          <div className="flex flex-row items-start gap-1">
            <HeaderButtonWithToolTip onClick={onClickExpand} text="Expand">
              <ArrowsPointingOutIcon className="h-3 w-3 text-gray-400" />
            </HeaderButtonWithToolTip>{" "}
            {rule.source === "default" ? (
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

        <span
          style={{
            fontSize: tinyFont,
          }}
          className="mt-1 line-clamp-3 text-gray-400"
        >
          {rule.rule}
        </span>
        {rule.if ? (
          <div
            style={{
              fontSize: tinyFont,
            }}
            className="mt-1.5 flex flex-col gap-1"
          >
            <span className="italic">Applies if</span>
            <code className="line-clamp-1 px-1 py-0.5 text-gray-400">
              {rule.if.replace(/\${{|}}/g, "")}
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
    // Add a displayed rule for the base system chat message when in chat mode
    if (mode === "chat") {
      const baseMessage =
        config.selectedModelByRole.chat?.baseChatSystemMessage;
      if (baseMessage) {
        rules.unshift({
          rule: baseMessage,
          source: "model-chat-options",
        });
      } else {
        rules.unshift({
          rule: DEFAULT_CHAT_SYSTEM_MESSAGE,
          source: "default",
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
