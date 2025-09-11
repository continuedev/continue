import { By, WebDriver, WebElement, WebView } from "vscode-extension-tester";

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

  /**
   * Finds a web element by its aria-label attribute within a WebView.
   * @param view - The WebView to search within.
   * @param ariaLabel - The aria-label value to search for.
   * @returns A promise that resolves to the WebElement found.
   */
  public static getElementByAriaLabel(
    view: WebView,
    ariaLabel: string,
  ): Promise<WebElement> {
    return view.findWebElement(By.css(`[aria-label='${ariaLabel}']`));
  }

  public static getElementByClassName(
    driver: WebDriver,
    className: string,
  ): Promise<WebElement> {
    return driver.findElement(
      // By.xpath("//*[contains(@class, 'ced-') and matches(@class, 'ced-2-TextEditorDecorationType[0-9]+-4')]")
      By.css(`*[class*='${className}']`),
      // By.xpath(`//span[contains(@class, '${className}')]`),
      // By.css("div[class*='TextEditorDecorationType'][style*='filter']")
    );
  }
}
