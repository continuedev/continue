import { Chat } from "./Chat";

export default function GUI() {
  return (
    <div className="flex w-screen flex-row overflow-hidden"> 
      <main className="no-scrollbar flex flex-1 flex-col overflow-y-auto">
        <Chat />
      </main>
    </div>
  );
}
