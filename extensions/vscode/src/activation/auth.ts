import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";

export async function setupAuth() {
  const session = await vscode.authentication.getSession("github", [], {
    createIfNone: true,
  });
  return session;
}

export class ManualTokenAuthProvider implements vscode.AuthenticationProvider {
  constructor(
    public onDidChangeSessions: vscode.Event<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>,
    private readonly context: vscode.ExtensionContext,
  ) {}

  getSessions(
    scopes?: readonly string[] | undefined,
  ): Thenable<readonly vscode.AuthenticationSession[]> {
    const sessions = this.context.globalState.get<
      vscode.AuthenticationSession[]
    >("continue.manualTokenSessions");
    return Promise.resolve(
      sessions?.filter((session) => {
        if (!scopes) {
          return true;
        }
        return !scopes.some((scope) => session.scopes.indexOf(scope) === -1);
      }) ?? [],
    );
  }
  async createSession(
    scopes: readonly string[],
  ): Promise<vscode.AuthenticationSession> {
    const token = await vscode.window.showInputBox({
      prompt: "Enter your Continue user token",
      ignoreFocusOut: true,
    });

    if (!token) {
      throw new Error("User canceled");
    }

    const session: vscode.AuthenticationSession = {
      id: uuidv4(),
      accessToken: token,
      account: {
        id: token,
        label: token,
      },
      scopes: [],
    };
    return session;
  }
  removeSession(sessionId: string): Thenable<void> {
    return this.context.globalState.update(
      "continue.manualTokenSessions",
      (sessions: vscode.AuthenticationSession[] | undefined) =>
        sessions?.filter((session) => session.id !== sessionId),
    );
  }
}
