import { By, WebDriver, WebView } from "vscode-extension-tester";
import { SelectorUtils } from "./SelectorUtils";

export class GUISelectors {
  public static getDescription(view: WebView) {
    return view.findWebElement(By.xpath("//*[contains(text(), 'Quickly')]"));
  }

  public static getTipTapEditor(view: WebView) {
    return view.findWebElement(By.className("tiptap"));
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

  public static getListbox(view: WebView) {
    const listbox = view.findWebElement(By.css('[role="listbox"]'));
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
}
