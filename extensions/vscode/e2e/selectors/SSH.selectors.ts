import { By, SideBarView } from "vscode-extension-tester";

export class SSHSelectors {
  public static async connectedToRemoteConfirmationMessage() {
    const view = new SideBarView();
    const element = await view.findElement(
      By.xpath('//*[contains(text(), "Connected to remote.")]'),
    );
    return element;
  }
}
