import { useMemo } from "react";
import { History } from "../../components/History";
import { useIdeMessengerRequest } from "../../hooks";
import { Chat } from "./Chat";

export default function GUI() {
  const getIdeInfoArgs = useMemo(() => ({} as any), []);
  const { result: ideInfo } = useIdeMessengerRequest("getIdeInfo", getIdeInfoArgs);
  const showHistory = ideInfo && ideInfo.name !== 'LightIde';

  return (
    <div className="flex w-screen flex-row overflow-hidden">
      {showHistory && (
        <aside className="4xl:flex border-vsc-input-border no-scrollbar hidden w-96 overflow-y-auto border-0 border-r border-solid">
          <History />
        </aside>
      )}
      <main className="no-scrollbar flex flex-1 flex-col overflow-y-auto">
        <Chat />
      </main>
    </div>
  );
}
