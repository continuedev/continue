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
