import { parseConfigYaml, type Rule } from "@continuedev/config-yaml";
import { ArrowsPointingOutIcon, PencilIcon } from "@heroicons/react/24/outline";
import { useContext, useMemo } from "react";
import { useSelector } from "react-redux";
import { defaultBorderRadius, vscCommandCenterActiveBorder } from "../../..";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch } from "../../../../redux/hooks";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../../redux/slices/uiSlice";
import { RootState } from "../../../../redux/store";
import { fontSize } from "../../../../util";
import HeaderButtonWithToolTip from "../../../gui/HeaderButtonWithToolTip";
import { ExploreBlocksButton } from "./ExploreBlocksButton";

interface RuleCardProps {
  index: number;
  rule: Rule;
  onClick: () => void;
  title: string;
}

const RuleCard: React.FC<RuleCardProps> = ({ index, rule, onClick, title }) => {
  const dispatch = useAppDispatch();

  function onClickExpand() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <div className="p-4 text-center">
          <h3>{title}</h3>
          <pre className="max-w-full overflow-x-scroll">
            {/** TODO: Render the rule in a more readable way */}
            {JSON.stringify(rule)}
          </pre>
        </div>,
      ),
    );
  }

  const renderRuleContent = () => {
    if (typeof rule === "string") {
      return <div>{rule}</div>;
    }

    if (rule.rule) {
      return (
        <div>
          <div>{rule.rule}</div>
          {rule.if && <div className="text-gray-500">if: {rule.if}</div>}
        </div>
      );
    }

    return <div>{JSON.stringify(rule)}</div>;
  };

  return (
    <div
      style={{
        borderRadius: defaultBorderRadius,
        border: `1px solid ${vscCommandCenterActiveBorder}`,
      }}
      className="px-2 py-1 transition-colors"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div
              className="text-vsc-foreground mb-1"
              style={{
                fontSize: fontSize(-2),
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: fontSize(-3),
              }}
              className="line-clamp-3 text-gray-400"
            >
              {renderRuleContent()}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <HeaderButtonWithToolTip onClick={onClickExpand} text="Expand">
              <ArrowsPointingOutIcon className="h-3 w-3 text-gray-400" />
            </HeaderButtonWithToolTip>{" "}
            <HeaderButtonWithToolTip onClick={onClick} text="Edit">
              <PencilIcon className="h-3 w-3 text-gray-400" />
            </HeaderButtonWithToolTip>
          </div>
        </div>
      </div>
    </div>
  );
};

export function RulesSection() {
  const ideMessenger = useContext(IdeMessengerContext);
  const { selectedProfile } = useAuth();

  const rules = useSelector(
    (state: RootState) => state.config.config.rules ?? [],
  );

  const mergedRules = useMemo(() => {
    const parsed = selectedProfile?.rawYaml
      ? parseConfigYaml(selectedProfile?.rawYaml ?? "")
      : undefined;
    return rules.map((rule, index) => ({
      unrolledRule: rule,
      ruleFromYaml: parsed?.rules?.[index],
    }));
  }, [rules]);

  const openUrl = (path: string) =>
    ideMessenger.request("controlPlane/openUrl", {
      path,
      orgSlug: undefined,
    });

  return (
    <div>
      <div className="space-y-3">
        {mergedRules.map((rule, index) => {
          if (!rule.ruleFromYaml) {
            return (
              <RuleCard
                key={index}
                index={index}
                rule={rule.unrolledRule}
                onClick={() =>
                  ideMessenger.post("config/openProfile", {
                    profileId: undefined,
                  })
                }
                title="Locally Defined Rule"
              />
            );
          }

          if (typeof rule.ruleFromYaml === "string") {
            const slug = `${selectedProfile?.fullSlug.ownerSlug}/${selectedProfile?.fullSlug.packageSlug}`;

            return (
              <RuleCard
                key={index}
                index={index}
                rule={rule.unrolledRule}
                onClick={() => openUrl(`${slug}/new-version`)}
                title="Inline Rule"
              />
            );
          }

          if ("uses" in rule.ruleFromYaml) {
            const ruleSlug = rule.ruleFromYaml?.uses;

            return (
              <RuleCard
                key={index}
                index={index}
                rule={rule.unrolledRule}
                onClick={() => openUrl(`${ruleSlug}/new-version`)}
                title={ruleSlug}
              />
            );
          }

          // TODO: Handle rules as object with 'if'
          return null;
        })}
      </div>
      <ExploreBlocksButton blockType="rules" />
    </div>
  );
}
