import { History } from "../../components/History";
import { Chat } from "./Chat";

export default function GUI() {
  return (
    <div className="flex w-screen flex-row overflow-hidden">
      <aside className="4xl:flex border-vsc-input-border no-scrollbar hidden w-96 overflow-y-auto border-0 border-r border-solid">
        <History />
      </aside>
      <main className="no-scrollbar flex flex-1 flex-col overflow-y-auto">
        <Chat />
      </main>
    </div>
  );
}
