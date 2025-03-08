import { By, WebDriver, WebView } from "vscode-extension-tester";

import { SelectorUtils } from "./SelectorUtils";

export class GUISelectors {
  public static getDescription(view: WebView) {
    return view.findWebElement(By.xpath("//*[contains(text(), 'quickly')]"));
  }

  public static getMessageInputFields(view: WebView) {
    return view.findWebElements(By.className("tiptap"));
  }

  public static async getMessageInputFieldAtIndex(
    view: WebView,
    index: number,
  ) {
    const elements = await this.getMessageInputFields(view);
    return elements[index];
  }

  public static getAllIframes(driver: WebDriver) {
    return driver.findElements(By.css("iframe"));
  }

  public static getReactIframe(driver: WebDriver) {
    return driver.findElement(By.css("iframe"));
  }

  public static getSubmitInputButton(view: WebView) {
    return SelectorUtils.getElementByDataTestId(view, "submit-input-button");
  }

  public static getAcceptToolCallButton(view: WebView) {
    return SelectorUtils.getElementByDataTestId(
      view,
      "accept-tool-call-button",
    );
  }

  public static getModelDropdownButton(view: WebView) {
    return SelectorUtils.getElementByDataTestId(view, "model-select-button");
  }

  public static getFirstContextProviderDropdownItem(view: WebView) {
    return SelectorUtils.getElementByDataTestId(
      view,
      "context-provider-dropdown-item",
    );
  }

  public static getContextItemsPeek(view: WebView) {
    return SelectorUtils.getElementByDataTestId(view, "context-items-peek");
  }

  public static getFirstContextItemsPeekItem(view: WebView) {
    return SelectorUtils.getElementByDataTestId(
      view,
      "context-items-peek-item",
    );
  }

  public static getNthHistoryTableRow(view: WebView, index: number) {
    return SelectorUtils.getElementByDataTestId(view, `history-row-${index}`);
  }

  public static getNthMessageDeleteButton(view: WebView, index: number) {
    const adjustedIndex = 1 + index * 2;

    return SelectorUtils.getElementByDataTestId(
      view,
      `delete-button-${adjustedIndex}`,
    );
  }

  public static getModelDropdownOption(view: WebView, option: string) {
    return view.findWebElement(
      By.xpath(`//*[@role="listbox"]//*[contains(text(), "${option}")]`),
    );
  }

  public static getOnboardingTabButton(view: WebView, title: string) {
    return SelectorUtils.getElementByDataTestId(
      view,
      `onboarding-tab-${title}`,
    );
  }

  public static getBestChatApiKeyInput(view: WebView) {
    return SelectorUtils.getElementByDataTestId(
      view,
      "best-chat-api-key-input",
    );
  }

  public static getBestAutocompleteApiKeyInput(view: WebView) {
    return SelectorUtils.getElementByDataTestId(
      view,
      "best-autocomplete-api-key-input",
    );
  }

  public static getTutorialCard(view: WebView) {
    return SelectorUtils.getElementByDataTestId(view, "tutorial-card");
  }

  public static getThreadMessageByText(view: WebView, text: string) {
    return view.findWebElement(
      By.xpath(`//*[@class="thread-message"]//*[contains(text(), "${text}")]`),
    );
  }

  public static getHistoryNavButton(view: WebView) {
    return SelectorUtils.getElementByAriaLabel(view, "View History");
  }

  public static getNewSessionNavButton(view: WebView) {
    return SelectorUtils.getElementByAriaLabel(view, "New Session");
  }

  public static async getInputBoxCodeBlockAtIndex(
    view: WebView,
    index: number,
  ) {
    const firstInputField = await this.getMessageInputFieldAtIndex(view, index);

    const codeBlockElement = await firstInputField.findElement(
      By.xpath(".//code"),
    );

    return codeBlockElement;
  }

  public static getContinueExtensionBadge(view: WebView) {
    return SelectorUtils.getElementByAriaLabel(view, "Continue");
  }
}
