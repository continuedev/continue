import { History } from "../../components/History";
import { Chat } from "./Chat";

export default function GUI() {
  return (
    <div className="flex overflow-hidden">
      <aside className="4xl:block border-vsc-input-border no-scrollbar hidden w-96 overflow-y-auto border-0 border-r border-solid">
        <History />
      </aside>
      <main className="no-scrollbar flex flex-1 flex-col overflow-y-auto">
        {/* Temporarily commenting out until a near-term release when we can at least add an option for users to disable the tab bar */}
        {/* <TabBar /> */}
        <Chat />
      </main>
    </div>
  );
}
