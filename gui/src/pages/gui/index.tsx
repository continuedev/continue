import { History } from "../../components/History";
import { Chat } from "./Chat";

export default function GUI() {
  return (
    <div className="flex min-h-0 w-screen flex-row overflow-x-hidden">
      <aside className="no-scrollbar hidden min-h-0 w-96 overflow-y-auto border-0 border-r border-solid border-vsc-input-border 4xl:flex">
        <History />
      </aside>
      <main className="no-scrollbar flex min-h-0 flex-1 flex-col">
        <Chat />
      </main>
    </div>
  );
}
