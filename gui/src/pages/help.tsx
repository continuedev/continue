import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  Button,
  Hr,
  lightGray,
  vscBackground,
  vscForeground,
} from "../components";
import KeyboardShortcutsDialog from "../components/dialogs/KeyboardShortcuts";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useNavigationListener } from "../hooks/useNavigationListener";
import { SecondaryButton } from "../components";

function HelpPage() {
  useNavigationListener();
  const navigate = useNavigate();
  const ideMessenger = useContext(IdeMessengerContext);

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
      </div>

      <div className="p-6 flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="col-span-2">
            <h3 className="my-0">Documentation</h3>
            <p>
              Visit the documentation site to learn how to configure and use
              Continue.
            </p>
          </div>
          <a
            className="col-span-1 "
            href="https://docs.continue.dev/"
            target="_blank"
          >
            <SecondaryButton className="w-full">View docs</SecondaryButton>
          </a>
        </div>

        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="col-span-2">
            <h3 className="my-0">Tutorial</h3>
            <p>
              Open the tutorial to get a quick walkthrough of the most commonly
              used features in Continue.
            </p>
          </div>
          <SecondaryButton
            className="col-span-1 w-full"
            onClick={() => {
              ideMessenger.post("showTutorial", undefined);
            }}
          >
            Open tutorial
          </SecondaryButton>
        </div>

        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="col-span-2">
            <h3 className="my-0">Token usage stats</h3>
            <p>
              See how many tokens you're using each day and how they're
              distributed across your models.
            </p>
          </div>
          <SecondaryButton
            className="col-span-1"
            onClick={() => {
              navigate("/stats");
            }}
          >
            View token usage
          </SecondaryButton>
        </div>

        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="col-span-2">
            <h3 className="my-0">Have an issue?</h3>
            <p>Let us know on GitHub and we'll do our best to resolve it.</p>
          </div>
          <a
            href="https://github.com/continuedev/continue/issues/new/choose"
            target="_blank"
            className="no-underline"
          >
            <SecondaryButton className="grid grid-flow-col items-center gap-2">
              <svg
                viewBox="0 0 98 96"
                height={24}
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                  fill={vscForeground}
                />
              </svg>
              Create a GitHub issue
            </SecondaryButton>
          </a>
        </div>

        <div className="grid grid-cols-3 gap-4 items-center w-full">
          <div className="col-span-2">
            <h3 className="my-0">Join the community!</h3>
            <p>
              Join us on Discord to stay up-to-date on the latest developments
            </p>
          </div>
          <a
            href="https://discord.gg/vapESyrFmJ"
            target="_blank"
            className="no-underline"
          >
            <SecondaryButton className="grid grid-flow-col items-center gap-2 w-full">
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
            </SecondaryButton>
          </a>
        </div>
      </div>

      <KeyboardShortcutsDialog />
    </div>
  );
}

export default HelpPage;
