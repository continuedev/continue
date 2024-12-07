import { By, WebElement, WebView } from "vscode-extension-tester";

export class SelectorUtils {
  /**
   * Finds a web element by its data-testid attribute within a WebView.
   * @param view - The WebView to search within.
   * @param testId - The data-testid value to search for.
   * @returns A promise that resolves to the WebElement found.
   */
  public static getElementByDataTestId(
    view: WebView,
    testId: string,
  ): Promise<WebElement> {
    return view.findWebElement(By.css(`[data-testid='${testId}']`));
  }
}
