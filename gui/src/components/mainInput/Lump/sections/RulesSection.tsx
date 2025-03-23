import { parseConfigYaml } from "@continuedev/config-yaml";
import { PencilIcon } from "@heroicons/react/24/outline";
import { useContext, useMemo } from "react";
import { useSelector } from "react-redux";
import { defaultBorderRadius, vscCommandCenterActiveBorder } from "../../..";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { RootState } from "../../../../redux/store";
import { fontSize } from "../../../../util";
import HeaderButtonWithToolTip from "../../../gui/HeaderButtonWithToolTip";

interface RuleCardProps {
  index: number;
  rule: string;
  onClick: () => void;
  title: string;
}

const RuleCard: React.FC<RuleCardProps> = ({ index, rule, onClick, title }) => {
  const truncateRule = (rule: string) => {
    const maxLength = 75;
    return rule.length > maxLength
      ? `${rule.substring(0, maxLength)}...`
      : rule;
  };

  return (
    <div
      style={{
        borderRadius: defaultBorderRadius,
        border: `1px solid ${vscCommandCenterActiveBorder}`,
      }}
      className="px-2 py-1 transition-colors"
    >
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
              whiteSpace: "pre-line",
            }}
            className="text-gray-400"
          >
            {truncateRule(rule)}
          </div>
        </div>
        <HeaderButtonWithToolTip onClick={onClick} text="Edit">
          <PencilIcon className="h-3 w-3 text-gray-400" />
        </HeaderButtonWithToolTip>
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
    <div className="space-y-4">
      {mergedRules.length === 0 ? (
        <div className="rounded-lg bg-[#1e1e1e] p-6">
          <p className="italic text-gray-400">No rules defined yet</p>
        </div>
      ) : (
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

            if (!rule.ruleFromYaml?.uses) {
              return null;
            }

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
          })}
        </div>
      )}
    </div>
  );
}
