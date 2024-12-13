import { By, WebDriver, WebView } from "vscode-extension-tester";
import { SelectorUtils } from "./SelectorUtils";

export class GUISelectors {
  public static getDescription(view: WebView) {
    return view.findWebElement(By.xpath("//*[contains(text(), 'Quickly')]"));
  }

  public static getMessageInputFields(view: WebView) {
    return view.findWebElements(By.className("tiptap"));
  }

  public static async getMessageInputFieldAtIndex(
    view: WebView,
    index: number,
  ) {
    const elements = await view.findWebElements(By.className("tiptap"));
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

  public static getModelDropdownButton(view: WebView) {
    return SelectorUtils.getElementByDataTestId(view, "model-select-button");
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
}
