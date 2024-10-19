import { Chat } from "./Chat";
import { History } from "../../components/History";
import styled from "styled-components";
import { vscSidebarBorder } from "../../components";

export const Aside = styled.aside`
  border-right: 1px solid ${vscSidebarBorder};
`;

export default function GUI() {
  return (
    <div className="flex overflow-scroll">
      <Aside className="overflow-y-auto w-96 hidden 4xl:block">
        <History />
      </Aside>

      <main className="overflow-y-auto flex-1 flex flex-col">
        <Chat />
      </main>
    </div>
  );
}
