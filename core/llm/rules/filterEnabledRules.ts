import { RuleWithSource } from "../..";
import {
  generateRuleId,
  selectRuleEnabled,
} from "../../../gui/src/redux/slices/rulesSlice";
/**
 * Filters a list of rules based on whether they are enabled in the Redux state
 * @param rules The rules to filter
 * @param state The Redux state to use for checking enabled status
 * @returns Only the rules that are enabled
 */
export function filterEnabledRules(
  rules: RuleWithSource[],
  state: any,
): RuleWithSource[] {
  return rules.filter((rule) => {
    const ruleId = generateRuleId(rule);
    return selectRuleEnabled(state, ruleId);
  });
}
