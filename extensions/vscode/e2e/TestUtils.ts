import { expect } from "chai";
import { WebElement } from "vscode-extension-tester";

export class TestUtils {
  public static async waitForElement<T>(
    locatorFn: () => Promise<T>,
    timeout: number = 5000,
    interval: number = 500,
  ): Promise<T> {
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

  public static async expectNoElement(
    locatorFn: () => Promise<WebElement>,
    timeout: number = 1000,
    interval: number = 200,
  ): Promise<void> {
    const startTime = Date.now();
    let elementFound = false;

    while (Date.now() - startTime < timeout) {
      try {
        const element = await locatorFn();
        if (element) {
          elementFound = true;
          break;
        }
      } catch (e) {
        // Continue if there's an error (element not found)
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    expect(elementFound).to.be.false;
  }

  public static generateTestMessagePair(id: number = 0): {
    userMessage: string;
    llmResponse: string;
  } {
    return {
      userMessage: `TEST_USER_MESSAGE_${id}`,
      llmResponse: `TEST_LLM_RESPONSE_${id}`,
    };
  }
}
