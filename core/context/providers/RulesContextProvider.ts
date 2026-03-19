import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextItemUri,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
  RuleWithSource,
} from "../..";
class RulesContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "rules",
    displayTitle: "Rules",
    description: "Mention rules files",
    type: "submenu",
    renderInlineAs: "",
  };

  // This is only used within this class. Worst case if there are exact duplicates is that one always calls the other, but this is an extreme edge case
  // Can eventually pull in more metadata, but this is experimental
  private getIdFromRule(rule: RuleWithSource): string {
    return rule.slug ?? rule.sourceFile ?? rule.name ?? rule.rule;
  }

  private getNameFromRule(rule: RuleWithSource): string {
    return rule.name ?? rule.slug ?? rule.sourceFile ?? rule.source;
  }

  private getDescriptionFromRule(rule: RuleWithSource): string {
    return rule.description ?? rule.name ?? "";
  }

  private getUriFromRule(rule: RuleWithSource): ContextItemUri | undefined {
    if (rule.sourceFile) {
      return {
        type: "file",
        value: rule.sourceFile,
      };
    }

    return undefined;
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const rule = extras.config.rules.find(
      (rule) => this.getIdFromRule(rule) === query,
    );
    if (!rule) {
      return [];
    }

    return [
      {
        name: this.getNameFromRule(rule),
        content: rule.rule,
        description: this.getDescriptionFromRule(rule),
        uri: this.getUriFromRule(rule),
      },
    ];
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    return args.config.rules.map((rule) => ({
      id: this.getIdFromRule(rule),
      description: this.getDescriptionFromRule(rule),
      title: this.getNameFromRule(rule),
    }));
  }
}

export default RulesContextProvider;
