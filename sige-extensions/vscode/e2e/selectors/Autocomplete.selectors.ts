import { By, WebDriver } from "vscode-extension-tester";

export class AutocompleteSelectors {
  public static async getGhostTextContent(driver: WebDriver) {
    const element = await driver.findElement(
      By.xpath("//span[contains(@class, 'ghost-text-decoration')]"),
    );

    return element.getText();
  }
}
