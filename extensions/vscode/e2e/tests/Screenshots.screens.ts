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
  By,
  EditorView,
  Key,
  VSBrowser,
  WebDriver,
  WebElement,
  WebView,
  Workbench,
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
    await hideOnboardingCard();
    await widenPanel();
  });

  /**
   * Settings needs the panel to be at least the GUI's `sm` width (330px) and
   * shows "Screen width too small" below it; the default secondary side bar is
   * narrower. Close the primary side bar and grow the panel. VS Code keeps the
   * width when the panel is closed and opened again by each shot.
   */
  async function widenPanel() {
    try {
      await TestUtils.waitForTimeout(1000);
      await TestUtils.waitForSuccess(() =>
        new Workbench().executeCommand("View: Close Primary Side Bar"),
      );
      // Drag the secondary side bar's left edge (the vertical sash nearest
      // to it) to the left. "Increase Current View Size" grows whatever has
      // focus, which here was the editor.
      const driver = VSBrowser.instance.driver;
      const bar = await driver.findElement(By.css(".part.auxiliarybar"));
      const barRect = await bar.getRect();
      const sashes = await driver.findElements(By.css(".monaco-sash.vertical"));
      let best: { sash: WebElement; dist: number } | undefined;
      for (const sash of sashes) {
        const r = await sash.getRect();
        const dist = Math.abs(r.x + r.width / 2 - barRect.x);
        if (r.height > 100 && (!best || dist < best.dist)) {
          best = { sash, dist };
        }
      }
      if (!best || best.dist > 20) throw new Error("no sash next to the panel");
      await driver
        .actions({ async: true })
        .move({ origin: best.sash })
        .press()
        .move({
          x: -420,
          y: 0,
          // Origin.POINTER; vscode-extension-tester does not re-export Origin.
          origin: "pointer" as any,
          duration: 300,
        })
        .release()
        .perform();
      await TestUtils.waitForTimeout(500);
      const after = await bar.getRect();
      console.log(
        `[screenshot] panel width ${barRect.width} -> ${after.width}`,
      );
    } catch (e) {
      console.log(
        `[screenshot] could not widen the panel: ${(e as Error).message.split("\n")[0]}`,
      );
    }
  }

  /**
   * The first-run onboarding card fills the empty chat. Mark onboarding as
   * done in the webview's localStorage (the keys and JSON encoding that
   * gui/src/util/localStorage.ts uses), then reload the webviews so the chat
   * renders without it.
   */
  async function hideOnboardingCard() {
    try {
      await GUIActions.toggleGui();
      ({ view, driver } = await GUIActions.switchToReactIframe());
      await driver.executeScript(`
        localStorage.setItem("onboardingStatus", JSON.stringify("Completed"));
        localStorage.setItem("hasDismissedOnboardingCard", JSON.stringify(true));
      `);
      await view.switchBack();
      await new Workbench().executeCommand("Developer: Reload Webviews");
      await TestUtils.waitForTimeout(2000);
    } catch (e) {
      console.log(
        `[screenshot] could not hide the onboarding card: ${(e as Error).message.split("\n")[0]}`,
      );
    } finally {
      try {
        await VSBrowser.instance.driver.switchTo().defaultContent();
        await GUIActions.toggleGui(); // closed again; each shot opens it
      } catch {
        // ignore
      }
    }
  }

  /** Opens the chat panel fresh, runs `body`, and screenshots the window. */
  async function shot(name: string, body: () => Promise<void>) {
    try {
      await new EditorView().closeAllEditors().catch(() => {});
      await GUIActions.toggleGui();
      ({ view, driver } = await GUIActions.switchToReactIframe({
        requireDisplayed: true,
      }).catch(() => GUIActions.switchToReactIframe()));
      await body();
      // Park the pointer in a corner so no hover tooltip (e.g. "Select
      // Model") covers the input; open menus stay open.
      await driver
        .actions()
        .move({ x: 1, y: 1, origin: "viewport" as any })
        .perform()
        .catch(() => {});
      await TestUtils.waitForTimeout(800); // let animations settle
      await view.switchBack();
      await save(VSBrowser.instance.driver, name);
      results.push(`ok      ${name}`);
    } catch (e) {
      results.push(`FAILED  ${name}: ${(e as Error).message.split("\n")[0]}`);
      // Save what the driver was looking at, to tell a wrong frame from a
      // missing element.
      try {
        const html = await VSBrowser.instance.driver.getPageSource();
        const url = await VSBrowser.instance.driver
          .executeScript("return location.href")
          .catch(() => "?");
        fs.mkdirSync(OUT_DIR, { recursive: true });
        fs.writeFileSync(
          path.join(OUT_DIR, `${name}.FAILED.html`),
          `<!-- ${url} -->\n${html}`,
        );
      } catch {
        // nothing to save
      }
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

  /**
   * Run a command from the palette, then go back into the webview. The panel's
   * title actions (New Session, Open Settings) are outside the webview and
   * collapse into an overflow menu when the panel is narrow, so the shots use
   * the commands instead of clicking them.
   */
  async function runCommand(title: string) {
    await view.switchBack();
    await TestUtils.waitForSuccess(() => new Workbench().executeCommand(title));
    await TestUtils.waitForTimeout(500);
    // Reloading the webviews leaves hidden copies around; without
    // requireDisplayed the first, hidden one can be picked, and every lookup
    // after the command then times out.
    ({ view, driver } = await TestUtils.waitForSuccess(() =>
      GUIActions.switchToReactIframe({ requireDisplayed: true }),
    ));
  }

  async function newSession() {
    await runCommand("Continuous: New Session");
    await TestUtils.waitForTimeout(1000); // the new session takes focus
  }

  async function openSettings() {
    await runCommand("Continuous: Open Settings");
    await TestUtils.waitForTimeout(800);
  }

  /** Script clicks: a neighbouring toolbar item can intercept a real click. */
  async function scriptClick(el: WebElement) {
    await driver.executeScript("arguments[0].click()", el);
  }

  /**
   * A real click, or a script click when something on top intercepts it.
   * Some menus (the model picker) only open on a real click.
   */
  async function click(el: WebElement) {
    try {
      await el.click();
    } catch (e) {
      if (!/intercepted|not clickable/i.test((e as Error).message)) throw e;
      await scriptClick(el);
    }
  }

  /**
   * Open a picker and choose an option. Right after New Session the input
   * takes focus and can close a menu that just opened, so the open is
   * retried until the option shows.
   */
  async function pick(
    button: () => Promise<WebElement>,
    option: () => Promise<WebElement>,
  ) {
    const el = await TestUtils.waitForSuccess(async () => {
      await click(await button());
      return TestUtils.waitForSuccess(option, 2000);
    });
    await click(el);
  }

  async function selectMode(mode: string) {
    await pick(
      () => GUISelectors.getModeDropdownButton(view),
      () => GUISelectors.getModeDropdownOption(view, mode),
    );
  }

  async function selectModel(model: string) {
    await pick(
      () => GUISelectors.getModelDropdownButton(view),
      () => GUISelectors.getModelDropdownOption(view, model),
    );
  }

  /** Wait for text anywhere in the chat, e.g. the end of a scripted reply. */
  async function waitForText(text: string) {
    await TestUtils.waitForSuccess(
      () =>
        view.findWebElement(
          By.xpath(`//*[contains(normalize-space(.), "${text}")][not(*)]`),
        ),
      DEFAULT_TIMEOUT.MD,
    );
    await TestUtils.waitForTimeout(500);
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
        GUISelectors.getModelDropdownOption(view, "GPT-5"),
      );
    });

    await shot("mode-picker", async () => {
      const button = await GUISelectors.getModeDropdownButton(view);
      // A neighbouring toolbar item overlaps it in a narrow panel, which makes
      // a WebDriver click fail; a script click reaches the button itself.
      await driver.executeScript("arguments[0].click()", button);
      await TestUtils.waitForSuccess(() =>
        GUISelectors.getModeDropdownOption(view, "Agent"),
      );
    });

    await shot("chat-response", async () => {
      await newSession();
      await selectMode("Chat");
      await selectModel("GPT-5");
      await send("Explain what this project does");
      await waitForText("npm test"); // the end of the scripted reply
    });

    await shot("agent-response", async () => {
      await newSession();
      await selectModel("Claude Sonnet 4.5");
      await selectMode("Agent");
      await send("What changed on this branch?");
      // The scripted agent views the diff, then summarises it.
      await waitForText("No other files are touched");
    });

    await shot("settings", async () => {
      await openSettings();
    });

    await shot("settings-configs", async () => {
      await openSettings();
      const configs = await TestUtils.waitForSuccess(() =>
        view.findWebElement(By.css("[data-testid='tab-configs']")),
      );
      await configs.click();
      await TestUtils.waitForTimeout(800);
    });

    await shot("settings-tools", async () => {
      await openSettings();
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
