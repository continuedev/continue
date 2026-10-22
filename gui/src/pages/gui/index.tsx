import { History } from "../../components/History";
import { Chat } from "./Chat";

export default function GUI() {
  return (
    <div className="flex min-h-0 w-screen flex-row overflow-x-hidden">
      <aside className="4xl:flex border-vsc-input-border no-scrollbar hidden min-h-0 w-96 overflow-y-auto border-0 border-r border-solid">
        <History />
      </aside>
      {/* min-w-0 so long code lines or unbroken strings can't widen the chat
          past the webview, where it (and the input controls) gets clipped */}
      <main className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col">
        <Chat />
      </main>
    </div>
  );
}
