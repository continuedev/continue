import { Play } from "@styled-icons/heroicons-outline";
import { useSelector } from "react-redux";
import styled from "styled-components";
import { RootStore } from "../redux/store";

const DEFAULT_SIZE = "28px";

const FlashingDiv = styled.div`
  margin: auto;
  width: ${DEFAULT_SIZE};
  animation: flash 1.2s infinite ease-in-out;
  @keyframes flash {
    0% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.4;
    }
  }
`;

function Loader(props: { size?: string }) {
  const vscMediaUrl = useSelector(
    (state: RootStore) => state.config.vscMediaUrl
  );
  return (
    <FlashingDiv>
      {vscMediaUrl ? (
        <img src={`${vscMediaUrl}/play_button.png`} width="22px" />
      ) : (
        <Play width={props.size || DEFAULT_SIZE} />
      )}
    </FlashingDiv>
  );
}

export default Loader;
