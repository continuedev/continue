import { By, WebDriver } from "vscode-extension-tester";

export class NextEditSelectors {
  /**
   * Get the SVG decoration element if present (for next edit).
   */
  public static async getSvgDecoration(driver: WebDriver) {
    console.log("===");
    // return SelectorUtils.getElementByClassName(
    //   driver,
    //   "TextEditorDecorationType",
    // );
    return Promise.any([
      await driver.findElement(By.css("[class*='TextEditorDecorationType']")),
      await driver.findElement(By.css("[class*=TextEditorDecorationType]")),
      await driver.findElement(By.css("*[class*='TextEditorDecorationType']")),
      await driver.findElement(By.css("*[class*=TextEditorDecorationType]")),
      await driver.findElement(
        By.css("span[class*='TextEditorDecorationType']"),
      ),
      await driver.findElement(By.css("span[class*=TextEditorDecorationType]")),
      await driver.findElement(
        By.xpath(`//span[contains(@class, 'TextEditorDecorationType')]`),
      ),
      await driver.findElement(
        By.xpath(`//span[contains(@class, TextEditorDecorationType)]`),
      ),
      await driver.findElement(
        By.xpath(`//*[contains(@class, 'TextEditorDecorationType')]`),
      ),
      await driver.findElement(
        By.xpath(`//*[contains(@class, TextEditorDecorationType)]`),
      ),
    ]);
    // try {
    //   const decorations = await driver.findElement(
    //     // By.xpath("//*[contains(@class, 'ced-') and matches(@class, 'ced-2-TextEditorDecorationType[0-9]+-4')]")
    //     By.css("[class*='TextEditorDecorationType']"),
    //     // By.css("div[class*='TextEditorDecorationType'][style*='filter']")
    //   );

    //   if (!decorations) {
    //     throw new Error("SVG decoraton not found");
    //   }

    //   return decorations;
    // } catch (error) {
    //   throw error;
    // }
  }

  // public static async getSvgDecoration(driver: WebDriver) {
  //   console.log("Attempting to find SVG decoration");
  //   try {
  //     // First check if any decoration elements exist at all
  //     try {
  //       const allDecorations = await driver.findElements(By.css("[class*='TextEditorDecorationType']"));
  //       console.log(`Found ${allDecorations.length} elements with TextEditorDecorationType class`);
  //     } catch (e) {
  //       console.log("No decoration elements found:", e.message);
  //     }

  //     const decorations = await driver.findElement(
  //       By.css("[class*='TextEditorDecorationType']"),
  //     );

  //     if (!decorations) {
  //       console.log("SVG decoration not found (null returned)");
  //       throw new Error("SVG decoration not found (null returned)");
  //     }

  //     console.log("SVG decoration found");
  //     return decorations;
  //   } catch (error) {
  //     console.log(`Error finding SVG decoration: ${error.message}`);
  //     throw error;
  //   }
  // }
}
