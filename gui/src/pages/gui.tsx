import {
  ChatBubbleOvalLeftIcon,
  CodeBracketSquareIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { JSONContent } from "@tiptap/react";
import { usePostHog } from "posthog-js/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  Button,
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscForeground,
} from "../components";
import FTCDialog from "../components/dialogs/FTCDialog";
import StepContainer from "../components/gui/StepContainer";
import TimelineItem from "../components/gui/TimelineItem";
import ContinueInputBox from "../components/mainInput/ContinueInputBox";
import useChatHandler from "../hooks/useChatHandler";
import useHistory from "../hooks/useHistory";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import { newSession, setInactive } from "../redux/slices/stateSlice";
import {
  setDialogEntryOn,
  setDialogMessage,
  setShowDialog,
} from "../redux/slices/uiStateSlice";
import { RootState } from "../redux/store";
import { getMetaKeyLabel, isMetaEquivalentKeyPressed } from "../util";
import { isJetBrains } from "../util/ide";

const TopGuiDiv = styled.div`
  overflow-y: scroll;

  scrollbar-width: none; /* Firefox */

  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
  }

  height: 100%;
`;

const StopButton = styled.div`
  width: fit-content;
  margin-right: auto;
  margin-left: auto;

  font-size: 12px;

  border: 0.5px solid ${lightGray};
  border-radius: ${defaultBorderRadius};
  padding: 4px 8px;
  color: ${lightGray};

  cursor: pointer;
`;

const StepsDiv = styled.div`
  position: relative;
  background-color: transparent;

  & > * {
    position: relative;
  }

  &::before {
    content: "";
    position: absolute;
    height: calc(100% - 12px);
    border-left: 2px solid ${lightGray};
    left: 28px;
    z-index: 0;
    bottom: 12px;
  }
`;

const NewSessionButton = styled.div`
  width: fit-content;
  margin-right: auto;
  margin-left: 8px;
  margin-top: 4px;

  font-size: 12px;

  border-radius: ${defaultBorderRadius};
  padding: 2px 8px;
  color: ${lightGray};

  &:hover {
    background-color: ${lightGray}33;
    color: ${vscForeground};
  }

  cursor: pointer;
`;

function fallbackRender({ error, resetErrorBoundary }) {
  // Call resetErrorBoundary() to reset the error boundary and retry the render.

  return (
    <div
      role="alert"
      className="px-2"
      style={{ backgroundColor: vscBackground }}
    >
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{error.message}</pre>

      <div className="text-center">
        <Button onClick={resetErrorBoundary}>Restart</Button>
      </div>
    </div>
  );
}

interface GUIProps {
  firstObservation?: any;
}

function GUI(props: GUIProps) {
  // #region Hooks
  const posthog = usePostHog();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // #endregion

  // #region Selectors
  const sessionState = useSelector((state: RootState) => state.state);

  const defaultModel = useSelector(defaultModelSelector);

  const active = useSelector((state: RootState) => state.state.active);

  // #endregion

  // #region State
  const [stepsOpen, setStepsOpen] = useState<(boolean | undefined)[]>([]);
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setShowLoading(true);
    }, 5000);
  }, []);

  // #endregion

  const mainTextInputRef = useRef<HTMLInputElement>(null);
  const topGuiDivRef = useRef<HTMLDivElement>(null);

  // #region Effects
  const [userScrolledAwayFromBottom, setUserScrolledAwayFromBottom] =
    useState<boolean>(false);

  const state = useSelector((state: RootState) => state.state);

  useEffect(() => {
    const handleScroll = () => {
      // Scroll only if user is within 200 pixels of the bottom of the window.
      const edgeOffset = -25;
      const scrollPosition = topGuiDivRef.current?.scrollTop || 0;
      const scrollHeight = topGuiDivRef.current?.scrollHeight || 0;
      const clientHeight = window.innerHeight || 0;

      if (scrollPosition + clientHeight + edgeOffset >= scrollHeight) {
        setUserScrolledAwayFromBottom(false);
      } else {
        setUserScrolledAwayFromBottom(true);
      }
    };

    topGuiDivRef.current?.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [topGuiDivRef.current]);

  useLayoutEffect(() => {
    if (userScrolledAwayFromBottom) return;

    topGuiDivRef.current?.scrollTo({
      top: topGuiDivRef.current?.scrollHeight,
      behavior: "instant" as any,
    });
  }, [topGuiDivRef.current?.scrollHeight, sessionState.history]);

  useEffect(() => {
    // Cmd + Backspace to delete current step
    const listener = (e: any) => {
      if (
        e.key === "Backspace" &&
        isMetaEquivalentKeyPressed(e) &&
        !e.shiftKey
      ) {
        dispatch(setInactive());
      }
    };
    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [active]);

  // #endregion

  const { streamResponse } = useChatHandler(dispatch);

  const sendInput = useCallback(
    (editorState: JSONContent) => {
      if (defaultModel?.provider === "free-trial") {
        const ftc = localStorage.getItem("ftc");
        if (ftc) {
          const u = parseInt(ftc);
          localStorage.setItem("ftc", (u + 1).toString());

          if (u >= 250) {
            dispatch(setShowDialog(true));
            dispatch(setDialogMessage(<FTCDialog />));
            posthog?.capture("ftc_reached");
            return;
          }
        } else {
          localStorage.setItem("ftc", "1");
        }
      }

      streamResponse(editorState);

      // Increment localstorage counter for popup
      const counter = localStorage.getItem("mainTextEntryCounter");
      if (counter) {
        let currentCount = parseInt(counter);
        localStorage.setItem(
          "mainTextEntryCounter",
          (currentCount + 1).toString(),
        );
        if (currentCount === 300) {
          dispatch(
            setDialogMessage(
              <div className="text-center p-4">
                👋 Thanks for using Continue. We are a beta product and love
                working closely with our first users. If you're interested in
                speaking, enter your name and email. We won't use this
                information for anything other than reaching out.
                <br />
                <br />
                <form
                  onSubmit={(e: any) => {
                    e.preventDefault();
                    posthog?.capture("user_interest_form", {
                      name: e.target.elements[0].value,
                      email: e.target.elements[1].value,
                    });
                    dispatch(
                      setDialogMessage(
                        <div className="text-center p-4">
                          Thanks! We'll be in touch soon.
                        </div>,
                      ),
                    );
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <input
                    style={{ padding: "10px", borderRadius: "5px" }}
                    type="text"
                    name="name"
                    placeholder="Name"
                    required
                  />
                  <input
                    style={{ padding: "10px", borderRadius: "5px" }}
                    type="email"
                    name="email"
                    placeholder="Email"
                    required
                  />
                  <button
                    style={{
                      padding: "10px",
                      borderRadius: "5px",
                      cursor: "pointer",
                    }}
                    type="submit"
                  >
                    Submit
                  </button>
                </form>
              </div>,
            ),
          );
          dispatch(setDialogEntryOn(false));
          dispatch(setShowDialog(true));
        }
      } else {
        localStorage.setItem("mainTextEntryCounter", "1");
      }
    },
    [
      sessionState.history,
      sessionState.contextItems,
      defaultModel,
      state,
      streamResponse,
    ],
  );

  const { saveSession } = useHistory(dispatch);

  useWebviewListener(
    "newSession",
    async () => {
      saveSession();
      mainTextInputRef.current?.focus?.();
    },
    [saveSession],
  );

  const isLastUserInput = useCallback(
    (index: number): boolean => {
      let foundLaterUserInput = false;
      for (let i = index + 1; i < state.history.length; i++) {
        if (state.history[i].message.role === "user") {
          foundLaterUserInput = true;
          break;
        }
      }
      return !foundLaterUserInput;
    },
    [state.history],
  );

  return (
    <>
      <TopGuiDiv ref={topGuiDivRef}>
        <div className="max-w-3xl m-auto">
          <StepsDiv>
            {state.history.map((item, index: number) => {
              return (
                <Fragment key={index}>
                  <ErrorBoundary
                    FallbackComponent={fallbackRender}
                    onReset={() => {
                      dispatch(newSession());
                    }}
                  >
                    {item.message.role === "user" ? (
                      <ContinueInputBox
                        onEnter={async (editorState) => {
                          streamResponse(editorState, index);
                        }}
                        isLastUserInput={isLastUserInput(index)}
                        isMainInput={false}
                        editorState={item.editorState}
                        contextItems={item.contextItems}
                      ></ContinueInputBox>
                    ) : (
                      <TimelineItem
                        item={item}
                        iconElement={
                          false ? (
                            <CodeBracketSquareIcon width="16px" height="16px" />
                          ) : false ? (
                            <ExclamationTriangleIcon
                              width="16px"
                              height="16px"
                              color="red"
                            />
                          ) : (
                            <ChatBubbleOvalLeftIcon
                              width="16px"
                              height="16px"
                            />
                          )
                        }
                        open={
                          typeof stepsOpen[index] === "undefined"
                            ? false
                              ? false
                              : true
                            : stepsOpen[index]!
                        }
                        onToggle={() => {}}
                      >
                        <StepContainer
                          index={index}
                          isLast={index === sessionState.history.length - 1}
                          isFirst={index === 0}
                          open={
                            typeof stepsOpen[index] === "undefined"
                              ? true
                              : stepsOpen[index]!
                          }
                          key={index}
                          onUserInput={(input: string) => {}}
                          item={item}
                          onReverse={() => {}}
                          onRetry={() => {}}
                          onDelete={() => {}}
                        />
                      </TimelineItem>
                    )}
                  </ErrorBoundary>
                </Fragment>
              );
            })}
          </StepsDiv>

          <ContinueInputBox
            onEnter={sendInput}
            isLastUserInput={false}
            isMainInput={true}
            hidden={active}
          ></ContinueInputBox>

          {active ? (
            <>
              <br />
              <br />
            </>
          ) : state.history.length > 0 ? (
            <NewSessionButton
              onClick={() => {
                saveSession();
              }}
              className="mr-auto"
            >
              New Session ({getMetaKeyLabel()} {isJetBrains() ? "J" : "L"})
            </NewSessionButton>
          ) : null}
        </div>
      </TopGuiDiv>
      {active && (
        <StopButton
          className="mt-auto"
          onClick={() => {
            dispatch(setInactive());
          }}
        >
          {getMetaKeyLabel()} ⌫ Cancel
        </StopButton>
      )}
    </>
  );
}

export default GUI;
