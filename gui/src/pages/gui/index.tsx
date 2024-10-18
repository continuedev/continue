import { Chat } from "./Chat";
import { History } from "../../components/History";

export default function GUI() {
  return (
    <div className="flex overflow-scroll">
      <aside className="4xl:block border-vsc-input-border hidden w-96 overflow-y-auto border-0 border-r border-solid">
        <History />
      </aside>

      <main className="flex flex-1 flex-col overflow-y-auto">
        <Chat />
      </main>
    </div>
  );
}
