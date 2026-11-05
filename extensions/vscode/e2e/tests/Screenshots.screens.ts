/**
 * Captures screenshots of the extension for the docs. Not part of the e2e
 * suite: CI collects only *.test.js, and this compiles to
 * Screenshots.screens.js. Run by the "Docs Screenshots" workflow, which
 * uploads e2e/_output/screenshots/ as an artifact.
 *
 * Every shot is independent: a failure is logged (and saved as
 * <name>.FAILED.png when possible) and the next shot still runs, so one stale
 * selector does not lose the whole set.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import {
  EditorView,
  Key,
  VSBrowser,
  WebDriver,
  WebView,
} from "vscode-extension-tester";

import { GlobalActions } from "../actions/Global.actions";
import { GUIActions } from "../actions/GUI.actions";
import { DEFAULT_TIMEOUT } from "../constants";
import { GUISelectors } from "../selectors/GUI.selectors";
import { TestUtils } from "../TestUtils";

const OUT_DIR = path.resolve(__dirname, "..", "screenshots");

async function save(driver: WebDriver, name: string) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const png = await driver.takeScreenshot();
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), png, "base64");
  console.log(`[screenshot] saved ${name}.png`);
}

describe("Docs screenshots", () => {
  let view: WebView;
  let driver: WebDriver;
  const results: string[] = [];

  before(async function () {
    this.timeout(DEFAULT_TIMEOUT.XL * 3);
    await GUIActions.moveContinueToSidebar(VSBrowser.instance.driver);
    await GlobalActions.openTestWorkspace();
    await GlobalActions.clearAllNotifications();
  });

  /** Opens the chat panel fresh, runs `body`, and screenshots the window. */
  async function shot(name: string, body: () => Promise<void>) {
    try {
      await new EditorView().closeAllEditors().catch(() => {});
      await GUIActions.toggleGui();
      ({ view, driver } = await GUIActions.switchToReactIframe({
        requireDisplayed: true,
      }).catch(() => GUIActions.switchToReactIframe()));
      await body();
      await TestUtils.waitForTimeout(800); // let animations settle
      await view.switchBack();
      await save(VSBrowser.instance.driver, name);
      results.push(`ok      ${name}`);
    } catch (e) {
      results.push(`FAILED  ${name}: ${(e as Error).message.split("\n")[0]}`);
      try {
        await VSBrowser.instance.driver.switchTo().defaultContent();
        await save(VSBrowser.instance.driver, `${name}.FAILED`);
      } catch {
        // nothing more to save
      }
    } finally {
      try {
        await VSBrowser.instance.driver.switchTo().defaultContent();
        await GUIActions.toggleGui(); // close the panel for the next shot
      } catch {
        // ignore
      }
    }
  }

  async function newSession() {
    const button = await TestUtils.waitForSuccess(() =>
      GUISelectors.getNewSessionNavButton(view),
    );
    await button.click();
  }

  async function send(text: string) {
    const [input] = await GUISelectors.getMessageInputFields(view);
    await input.sendKeys(text);
    await input.sendKeys(Key.ENTER);
  }

  it("captures the docs screenshots", async function () {
    this.timeout(DEFAULT_TIMEOUT.XL * 12);

    await shot("chat-empty", async () => {
      await newSession();
    });

    await shot("model-picker", async () => {
      const button = await GUISelectors.getModelDropdownButton(view);
      await button.click();
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getModelDropdownOption(view, "TEST LLM"),
      );
    });

    await shot("mode-picker", async () => {
      const button = await GUISelectors.getModeDropdownButton(view);
      await button.click();
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getModeDropdownOption(view, "Agent"),
      );
    });

    await shot("chat-response", async () => {
      await newSession();
      await GUIActions.selectModeFromDropdown(view, "Chat");
      await GUIActions.selectModelFromDropdown(view, "TEST LLM");
      await send("Explain what this project does");
      await TestUtils.waitForSuccess(
        () => GUISelectors.getThreadMessageByText(view, "Explain what"),
        DEFAULT_TIMEOUT.SM,
      );
      await TestUtils.waitForTimeout(1500); // the reply streams in
    });

    await shot("agent-tool-approval", async () => {
      await GUIActions.toggleToolPolicy(view, "view_diff", 2); // Ask first
      const back = await TestUtils.waitForSuccess(() =>
        GUISelectors.getBackButton(view),
      );
      await back.click();
      await newSession();
      await GUIActions.selectModelFromDropdown(view, "TOOL MOCK LLM");
      await GUIActions.selectModeFromDropdown(view, "Agent");
      await send("What changed on this branch?");
      await TestUtils.waitForSuccess(
        () => GUISelectors.getAcceptToolCallButton(view),
        DEFAULT_TIMEOUT.SM,
      );
    });

    await shot("settings", async () => {
      const button = await TestUtils.waitForSuccess(() =>
        GUISelectors.getSettingsNavButton(view),
      );
      await button.click();
      await TestUtils.waitForTimeout(800);
    });

    await shot("settings-tools", async () => {
      const button = await TestUtils.waitForSuccess(() =>
        GUISelectors.getSettingsNavButton(view),
      );
      await button.click();
      const tools = await TestUtils.waitForSuccess(() =>
        GUISelectors.getToolsTab(view),
      );
      await tools.click();
      await TestUtils.waitForTimeout(800);
    });

    console.log(["[screenshot] results:", ...results].join("\n  "));
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUT_DIR, "results.txt"),
      results.join("\n") + "\n",
    );
  });
});
