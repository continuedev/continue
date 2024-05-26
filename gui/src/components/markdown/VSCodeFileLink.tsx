import { useContext } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";

function VSCodeFileLink(props: { path: string; text?: string }) {
  const ideMessenger = useContext(IdeMessengerContext);
  return (
    <a
      href={`file://${props.path}`}
      onClick={() => {
        ideMessenger.post("openFile", { path: props.path });
      }}
    >
      {props.text || props.path}
    </a>
  );
}

export default VSCodeFileLink;
