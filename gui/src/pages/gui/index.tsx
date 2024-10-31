import { Chat } from "./Chat";
import { History } from "../../components/History";

export default function GUI() {
  return (
    <div className="flex overflow-hidden">
      <aside className="4xl:block border-vsc-input-border scrollbar-hide hidden w-96 overflow-y-auto border-0 border-r border-solid">
        <History />
      </aside>
      <main className="scrollbar-hide flex flex-1 flex-col overflow-y-auto">
        <Chat />
      </main>
    </div>
  );
}
