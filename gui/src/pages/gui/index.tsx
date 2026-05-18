import { History } from "../../components/History";
import { Chat } from "./Chat";
import { useLocalStorage } from "../../context/LocalStorage";
import i18n from "../../locales/i18n";

export default function GUI() {
  const { language } = useLocalStorage();
  i18n.changeLanguage(language || "en");
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
