import { expect } from "chai";
import { Key } from "vscode-extension-tester";

import { DEFAULT_TIMEOUT } from "./constants";

export class TestUtils {
  /**
   * In many cases it might be more useful to use existing Selenium
   * utilities. For example:
   *
   * await driver.wait(until.elementLocated(By.xpath(xpath)), 5000);
   *
   * There's also 'waitForAttributeValue'.
   */
  public static async waitForSuccess<T>(
    locatorFn: () => Promise<T>,
    timeout: number = DEFAULT_TIMEOUT.MD,
    interval: number = 500,
  ): Promise<T> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await locatorFn();
        return result;
      } catch (e) {
        if (Date.now() - startTime >= timeout) {
          throw new Error(
            `Element not found after ${timeout}ms timeout: ${locatorFn}`,
          );
        }
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(
      `Element not found after ${timeout}ms timeout: ${locatorFn}`,
    );
  }

  public static async logFailure<T>(locatorFn: () => Promise<T>): Promise<T> {
    try {
      const result = await locatorFn();
      return result;
    } catch (e) {
      throw new Error(`Element not found: ${locatorFn}`);
    }
  }

  public static async expectNoElement<T>(
    locatorFn: () => Promise<T>,
    timeout: number = 1000,
    interval: number = 200,
  ): Promise<void> {
    const startTime = Date.now();
    let elementFound = false;

    while (Date.now() - startTime < timeout) {
      try {
        const element = await locatorFn();
        console.log("ELEMENT", element);
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

  public static waitForTimeout(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public static get isMacOS(): boolean {
    return process.platform === "darwin";
  }

  public static get osControlKey() {
    return TestUtils.isMacOS ? Key.META : Key.CONTROL;
  }
}
