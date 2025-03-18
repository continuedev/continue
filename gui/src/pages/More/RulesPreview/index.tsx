import { parseConfigYaml } from "@continuedev/config-yaml";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { useContext, useMemo } from "react";
import { useSelector } from "react-redux";
import HeaderButtonWithToolTip from "../../../components/gui/HeaderButtonWithToolTip";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { RootState } from "../../../redux/store";

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
    <div className="rounded-lg bg-[#1e1e1e] p-4 transition-colors hover:bg-[#252525]">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 font-mono text-sm text-[#9cdcfe]">{title}</div>
          <div className="whitespace-pre-wrap font-mono text-sm text-gray-300">
            {truncateRule(rule)}
          </div>
        </div>
        <HeaderButtonWithToolTip onClick={onClick} text="Edit">
          <PencilSquareIcon className="h-4 w-4 transition-colors group-hover:text-blue-400" />
        </HeaderButtonWithToolTip>
      </div>
    </div>
  );
};

export function RulesPreview() {
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
      <h2 className="mb-4 text-lg font-semibold text-gray-200">
        Assistant Rules
      </h2>

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
