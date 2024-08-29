import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  Button,
  Hr,
  lightGray,
  vscBackground,
  vscForeground,
  vscInputBackground,
} from "../components";
import KeyboardShortcutsDialog from "../components/dialogs/KeyboardShortcuts";
import { useNavigationListener } from "../hooks/useNavigationListener";
import { useContext } from "react";
import { useThemeType } from "../hooks/useVscTheme";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useNavigationListener } from "../hooks/useNavigationListener";
import { SecondaryButton } from "../components";

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
  padding: 0px 10px;
  margin-right: 2px;
  background-color: transparent;
  color: ${vscForeground};
  &:hover {
    text-decoration: underline;
  }
`;

const ButtonContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem 0.5rem;
  margin: 0.75rem auto;
  width: 75%;
  max-width: 600px;

  @media (min-width: 726px) {
    grid-template-columns: repeat(3, 1fr);
  }
  
  @media (max-width: 400px) {
    width: 90%;
    
  }
`;


const StyledButton = styled.div<{
  backgroundColor?: string;
  hoverBackgroundColor?: string;
  themeType?: string;
}>`
  background-color: ${(props) => props.backgroundColor || vscBackground};
  border-radius: 0.6rem;
  box-shadow: 0px 0px 3px
    ${(props) =>
      props.themeType === "light"
        ? "rgba(0, 0, 0, 0.3)"
        : "rgba(255, 255, 255, 0.3)"};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem  0.5rem;
  text-align: center;
  font-size: clamp(0.85rem, 3.65vw, 1rem);
  font-weight: 500;
  color: ${vscForeground};
  cursor: pointer;
  width: 85%;
  height: 50px;

  @media (max-width: 400px) {
    height: clamp(35px, 12vw, 50px);
    padding: 0.3rem 0.25rem;
  }

  &:hover:not(:disabled) {
    background-color: ${(props) =>
      props.hoverBackgroundColor || vscInputBackground};
    border-color: ${(props) =>
      props.hoverBackgroundColor || vscInputBackground};
  }
`;

const StyledLink = styled(StyledButton).attrs({
  as: "a",
})<{ href: string; target?: string }>`
  white-space: nowrap;
  text-decoration: none;

  &:hover {
    color: inherit;
    text-decoration: none;
  }

  @media (max-width: 400px) {
    .icon {
      display: none;
    }
`;

// Todo: Add demo video
// Todo: Add documentation link
function HelpPage() {
  useNavigationListener();
  const navigate = useNavigate();
  const themeType = useThemeType();
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <div>
      <div
        className="items-center flex m-0 p-0 sticky top-0"
        style={{
          backgroundColor: vscBackground,
        }}
      >
        <ArrowLeftIcon
          width="1.2em"
          height="1.2em"
          onClick={() => navigate("/")}
          className="inline-block ml-4 cursor-pointer"
        />
        <h3 className="text-lg font-bold m-2 inline-block">Help</h3>
      </div>

      <div className="flex flex-col items-center justify-center w-full">
      <ButtonContainer>
        <StyledButton
          className="inline-flex flex-shrink-0"
          themeType={themeType}
          onClick={() => {
            ideMessenger.post("pearaiLogin", undefined);
            navigate("/");
          }}
        >
          Login to PearAI
        </StyledButton>
        <StyledLink
          href="https://trypear.ai/"
          target="_blank"
          themeType={themeType}
        >
          PearAI Website
        </StyledLink>

        <StyledButton
          className="inline-flex flex-shrink-0"
          themeType={themeType}
          onClick={() => {
            navigate("/stats");
          }}
        >
          View Usage
        </StyledButton>
        <StyledButton
          className="inline-flex flex-shrink-0"
          themeType={themeType}
          onClick={() => {
            ideMessenger.post("showTutorial", undefined);
            navigate("/onboarding");
          }}
        >
          Open Tutorial
        </StyledButton>
        <StyledLink
          className="flex items-center justify-center gap-2"
          href="https://github.com/trypear/pearai-app/"
          target="_blank"
          themeType={themeType}
        >
          <span className="icon"><GithubSVG /></span>
          Github
        </StyledLink>
        <StyledLink
          className="flex items-center justify-center gap-2"
          href="https://discord.gg/Uw9mVvFUk3"
          target="_blank"
          themeType={themeType}
        >
          <span className="icon"><DiscordSVG /></span>
          Discord
        </StyledLink>
      </ButtonContainer>
    </div>

      <KeyboardShortcutsDialog />
    </div>
  );
}

const GithubSVG = () => {
  return (
    <svg
      width="25px"
      height="25px"
      viewBox="0 0 20 20"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      fill="#000000"
    >
      <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
      <g
        id="SVGRepo_tracerCarrier"
        stroke-linecap="round"
        stroke-linejoin="round"
      ></g>
      <g id="SVGRepo_iconCarrier">
        {" "}
        <title>github [#6e6e6e]</title> <desc>Created with Sketch.</desc>{" "}
        <defs> </defs>{" "}
        <g
          id="Page-1"
          stroke="none"
          stroke-width="1"
          fill="none"
          fill-rule="evenodd"
        >
          {" "}
          <g
            id="Dribbble-Light-Preview"
            transform="translate(-140.000000, -7559.000000)"
            fill="#6e6e6e"
          >
            {" "}
            <g id="icons" transform="translate(56.000000, 160.000000)">
              {" "}
              <path
                d="M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399"
                id="github-[#6e6e6e]"
              >
                {" "}
              </path>{" "}
            </g>{" "}
          </g>{" "}
        </g>{" "}
      </g>
    </svg>
  );
};

const DiscordSVG = () => {
  return (
    <svg
      width="25px"
      height="25px"
      viewBox="0 -28.5 256 256"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid"
    >
      <g>
        <path
          d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"
          fill="#6e6e6e"
          fill-rule="nonzero"
        ></path>
      </g>
    </svg>
  );
};

export default HelpPage;
