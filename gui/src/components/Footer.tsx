import { useAppSelector } from "../redux/hooks";
import { selectSelectedChatModel } from "../redux/slices/configSlice";

function Footer() {
  const defaultModel = useAppSelector(selectSelectedChatModel);

  // TODO hook hub up to free trial
  // if (defaultModel?.provider === "free-trial") {
  //   return (
  //     <footer className="flex flex-col border-0 border-t border-solid border-t-zinc-700 px-2 py-2">
  //       <FreeTrialProgressBar
  //         completed={getLocalStorage("ftc") ?? 0}
  //         total={FREE_TRIAL_LIMIT_REQUESTS}
  //       />
  //     </footer>
  //   );
  // }
  return null;
}

export default Footer;
