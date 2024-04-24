import { useSelector } from "react-redux";
import { RootState } from "../../redux/store";
import styled from "styled-components";
import { PlayIcon } from "@heroicons/react/24/outline";

const DEFAULT_SIZE = "28px";

const FlashingDiv = styled.div`
  margin-top: 16px;
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
  const vscMediaUrl = window.vscMediaUrl;
  return (
    <FlashingDiv>
      {vscMediaUrl ? (
        <img src={`${vscMediaUrl}/play_button.png`} width="22px" />
      ) : (
        <PlayIcon width={props.size || DEFAULT_SIZE} />
      )}
    </FlashingDiv>
  );
}

export default Loader;
