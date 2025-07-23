import { By, WebDriver } from "vscode-extension-tester";

export class NextEditSelectors {
  /**
   * Get the SVG decoration element if present (for next edit).
   */
  public static async getSvgDecoration(driver: WebDriver) {
    try {
      const decorations = await driver.findElement(
        // By.xpath("//*[contains(@class, 'ced-') and matches(@class, 'ced-2-TextEditorDecorationType[0-9]+-4')]")
        By.css("[class*='TextEditorDecorationType']"),
        // By.css("div[class*='TextEditorDecorationType'][style*='filter']")
      );

      if (!decorations) {
        throw new Error("SVG decoraton not found");
      }

      return decorations;
    } catch (error) {
      console.error("Error finding SVG decoration:", error);
      throw error;
    }
  }
}
