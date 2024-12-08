import { WebElement } from "vscode-extension-tester";

export class TestUtils {
  public static async waitForElement(
    locatorFn: () => Promise<WebElement>,
    timeout: number = 5000,
    interval: number = 500,
  ): Promise<WebElement> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const element = await locatorFn();
        if (element) {
          return element;
        }
      } catch (e) {
        if (Date.now() - startTime >= timeout) {
          throw new Error(`Element not found after ${timeout}ms timeout`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Element not found after ${timeout}ms timeout`);
  }
}
