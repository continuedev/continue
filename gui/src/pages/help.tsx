import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { Button, lightGray, vscBackground, vscForeground } from "../components";
import KeyboardShortcutsDialog from "../components/dialogs/KeyboardShortcuts";
import { useNavigationListener } from "../hooks/useNavigationListener";
import { postToIde } from "../util/ide";

const ResourcesDiv = styled.div`
  margin: 4px;
  border-top: 0.5px solid ${lightGray};
  border-bottom: 0.5px solid ${lightGray};
`;

const IconDiv = styled.div<{ backgroundColor?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  padding: 12px;

  & > a {
    color: ${vscForeground};
    text-decoration: none;
    display: flex;
    align-items: center;
    width: 100%;
    justify-content: center;
  }

  &:hover {
    background-color: ${(props) => props.backgroundColor || lightGray};
  }
`;

const TutorialButton = styled(Button)`
  padding: 2px 4px;
  margin-left: auto;
  margin-right: 12px;
  background-color: transparent;
  color: ${vscForeground};
  border: 1px solid ${lightGray};
  &:hover {
    background-color: ${lightGray};
  }
`;

function HelpPage() {
  useNavigationListener();
  const navigate = useNavigate();

  return (
    <div className="overflow-y-scroll overflow-x-hidden">
      <div
        className="items-center flex m-0 p-0 sticky top-0"
        style={{
          borderBottom: `0.5px solid ${lightGray}`,
          backgroundColor: vscBackground,
        }}
      >
        <ArrowLeftIcon
          width="1.2em"
          height="1.2em"
          onClick={() => navigate("/")}
          className="inline-block ml-4 cursor-pointer"
        />
        <h3 className="text-lg font-bold m-2 inline-block">Help Center</h3>
        <TutorialButton
          onClick={() => {
            postToIde("showTutorial", undefined);
          }}
        >
          Open tutorial
        </TutorialButton>
      </div>

      <h3 className="my-3 mx-auto text-center">Resources</h3>
      <ResourcesDiv className="border">
        <IconDiv backgroundColor="rgb(234, 51, 35)">
          <a
            href="https://youtu.be/3Ocrc-WX4iQ?si=eDLYtkc6CXQoHsEc"
            target="_blank"
          >
            <svg
              width="42px"
              height="42px"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="-5.2 -4.5 60 60"
              fill={vscForeground}
            >
              <path d="M 44.898438 14.5 C 44.5 12.300781 42.601563 10.699219 40.398438 10.199219 C 37.101563 9.5 31 9 24.398438 9 C 17.800781 9 11.601563 9.5 8.300781 10.199219 C 6.101563 10.699219 4.199219 12.199219 3.800781 14.5 C 3.398438 17 3 20.5 3 25 C 3 29.5 3.398438 33 3.898438 35.5 C 4.300781 37.699219 6.199219 39.300781 8.398438 39.800781 C 11.898438 40.5 17.898438 41 24.5 41 C 31.101563 41 37.101563 40.5 40.601563 39.800781 C 42.800781 39.300781 44.699219 37.800781 45.101563 35.5 C 45.5 33 46 29.398438 46.101563 25 C 45.898438 20.5 45.398438 17 44.898438 14.5 Z M 19 32 L 19 18 L 31.199219 25 Z"></path>
            </svg>
            Demo Video
          </a>
        </IconDiv>
        <IconDiv backgroundColor={"#1bbe84a8"}>
          <a
            href="https://continue.dev/docs/how-to-use-continue"
            target="_blank"
          >
            <svg
              width="42px"
              height="42px"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="-2.2 -2 28 28"
              fill={vscForeground}
            >
              <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
            </svg>
            Documentation
          </a>
        </IconDiv>
        <IconDiv backgroundColor="rgb(88, 98, 227)">
          <a href="https://discord.gg/vapESyrFmJ" target="_blank">
            <svg
              width="42px"
              height="42px"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="-5 -5.5 60 60"
              fill={vscForeground}
            >
              <path d="M 41.625 10.769531 C 37.644531 7.566406 31.347656 7.023438 31.078125 7.003906 C 30.660156 6.96875 30.261719 7.203125 30.089844 7.589844 C 30.074219 7.613281 29.9375 7.929688 29.785156 8.421875 C 32.417969 8.867188 35.652344 9.761719 38.578125 11.578125 C 39.046875 11.867188 39.191406 12.484375 38.902344 12.953125 C 38.710938 13.261719 38.386719 13.429688 38.050781 13.429688 C 37.871094 13.429688 37.6875 13.378906 37.523438 13.277344 C 32.492188 10.15625 26.210938 10 25 10 C 23.789063 10 17.503906 10.15625 12.476563 13.277344 C 12.007813 13.570313 11.390625 13.425781 11.101563 12.957031 C 10.808594 12.484375 10.953125 11.871094 11.421875 11.578125 C 14.347656 9.765625 17.582031 8.867188 20.214844 8.425781 C 20.0625 7.929688 19.925781 7.617188 19.914063 7.589844 C 19.738281 7.203125 19.34375 6.960938 18.921875 7.003906 C 18.652344 7.023438 12.355469 7.566406 8.320313 10.8125 C 6.214844 12.761719 2 24.152344 2 34 C 2 34.175781 2.046875 34.34375 2.132813 34.496094 C 5.039063 39.605469 12.972656 40.941406 14.78125 41 C 14.789063 41 14.800781 41 14.8125 41 C 15.132813 41 15.433594 40.847656 15.621094 40.589844 L 17.449219 38.074219 C 12.515625 36.800781 9.996094 34.636719 9.851563 34.507813 C 9.4375 34.144531 9.398438 33.511719 9.765625 33.097656 C 10.128906 32.683594 10.761719 32.644531 11.175781 33.007813 C 11.234375 33.0625 15.875 37 25 37 C 34.140625 37 38.78125 33.046875 38.828125 33.007813 C 39.242188 32.648438 39.871094 32.683594 40.238281 33.101563 C 40.601563 33.515625 40.5625 34.144531 40.148438 34.507813 C 40.003906 34.636719 37.484375 36.800781 32.550781 38.074219 L 34.378906 40.589844 C 34.566406 40.847656 34.867188 41 35.1875 41 C 35.199219 41 35.210938 41 35.21875 41 C 37.027344 40.941406 44.960938 39.605469 47.867188 34.496094 C 47.953125 34.34375 48 34.175781 48 34 C 48 24.152344 43.785156 12.761719 41.625 10.769531 Z M 18.5 30 C 16.566406 30 15 28.210938 15 26 C 15 23.789063 16.566406 22 18.5 22 C 20.433594 22 22 23.789063 22 26 C 22 28.210938 20.433594 30 18.5 30 Z M 31.5 30 C 29.566406 30 28 28.210938 28 26 C 28 23.789063 29.566406 22 31.5 22 C 33.433594 22 35 23.789063 35 26 C 35 28.210938 33.433594 30 31.5 30 Z"></path>
            </svg>
            Continue Discord
          </a>
        </IconDiv>
        <IconDiv>
          <a
            href="https://github.com/continuedev/continue/issues/new/choose"
            target="_blank"
          >
            <svg
              width="42px"
              height="42px"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="-1.2 -1.2 32 32"
              fill={vscForeground}
            >
              <path d="M15,3C8.373,3,3,8.373,3,15c0,5.623,3.872,10.328,9.092,11.63C12.036,26.468,12,26.28,12,26.047v-2.051 c-0.487,0-1.303,0-1.508,0c-0.821,0-1.551-0.353-1.905-1.009c-0.393-0.729-0.461-1.844-1.435-2.526 c-0.289-0.227-0.069-0.486,0.264-0.451c0.615,0.174,1.125,0.596,1.605,1.222c0.478,0.627,0.703,0.769,1.596,0.769 c0.433,0,1.081-0.025,1.691-0.121c0.328-0.833,0.895-1.6,1.588-1.962c-3.996-0.411-5.903-2.399-5.903-5.098 c0-1.162,0.495-2.286,1.336-3.233C9.053,10.647,8.706,8.73,9.435,8c1.798,0,2.885,1.166,3.146,1.481C13.477,9.174,14.461,9,15.495,9 c1.036,0,2.024,0.174,2.922,0.483C18.675,9.17,19.763,8,21.565,8c0.732,0.731,0.381,2.656,0.102,3.594 c0.836,0.945,1.328,2.066,1.328,3.226c0,2.697-1.904,4.684-5.894,5.097C18.199,20.49,19,22.1,19,23.313v2.734 c0,0.104-0.023,0.179-0.035,0.268C23.641,24.676,27,20.236,27,15C27,8.373,21.627,3,15,3z"></path>
            </svg>
            GitHub Issues
          </a>
        </IconDiv>
      </ResourcesDiv>

      <KeyboardShortcutsDialog />
    </div>
  );
}

export default HelpPage;
