import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import { configSlice } from "../../../redux/slices/configSlice";
import { sessionSlice } from "../../../redux/slices/sessionSlice";
import ThinkingBlockPeek from "./ThinkingBlockPeek";

// ThinkingBlockPeek renders StyledMarkdownPreview, which reads
// `state.session`, so the session slice has to be present too.
const createMockStore = (expandThinkingBlocks?: boolean) =>
  configureStore({
    reducer: {
      config: configSlice.reducer,
      session: sessionSlice.reducer,
    },
    preloadedState: {
      config: {
        ...configSlice.getInitialState(),
        config: {
          ...configSlice.getInitialState().config,
          ui: { expandThinkingBlocks },
        },
      },
      session: sessionSlice.getInitialState(),
    },
  });

const renderPeek = (
  expandThinkingBlocks?: boolean,
  props: Partial<Parameters<typeof ThinkingBlockPeek>[0]> = {},
) => {
  const store = createMockStore(expandThinkingBlocks);
  const utils = render(
    <Provider store={store}>
      <ThinkingBlockPeek
        content="reasoning content"
        index={0}
        prevItem={null}
        {...props}
      />
    </Provider>,
  );
  return { ...utils, store };
};

// The block is always rendered; `aria-expanded` on the toggle is what
// reflects open/closed state.
const toggle = () => screen.getByTestId("thinking-block-peek");

describe("ThinkingBlockPeek", () => {
  it("renders collapsed when expandThinkingBlocks is unset", () => {
    renderPeek(undefined);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("renders collapsed when expandThinkingBlocks is false", () => {
    renderPeek(false);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("renders expanded when expandThinkingBlocks is true", () => {
    renderPeek(true);
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("expands an already-mounted block when the setting is turned on", () => {
    const { rerender, store } = renderPeek(false);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");

    // Simulate the config update event propagating back from core.
    const next = store.getState().config;
    store.dispatch({
      type: "config/updateConfig",
      payload: { ...next.config, ui: { expandThinkingBlocks: true } },
    });

    rerender(
      <Provider store={store}>
        <ThinkingBlockPeek
          content="reasoning content"
          index={0}
          prevItem={null}
        />
      </Provider>,
    );

    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses an already-mounted block when the setting is turned off", () => {
    const { rerender, store } = renderPeek(true);
    expect(toggle()).toHaveAttribute("aria-expanded", "true");

    const next = store.getState().config;
    store.dispatch({
      type: "config/updateConfig",
      payload: { ...next.config, ui: { expandThinkingBlocks: false } },
    });

    rerender(
      <Provider store={store}>
        <ThinkingBlockPeek
          content="reasoning content"
          index={0}
          prevItem={null}
        />
      </Provider>,
    );

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("stays expanded across streaming rerenders while the setting is on", () => {
    const store = createMockStore(true);

    const { rerender } = render(
      <Provider store={store}>
        <ThinkingBlockPeek
          content="partial"
          index={0}
          prevItem={null}
          inProgress={true}
        />
      </Provider>,
    );
    expect(toggle()).toHaveAttribute("aria-expanded", "true");

    // Content grows as reasoning streams in, then completes.
    rerender(
      <Provider store={store}>
        <ThinkingBlockPeek
          content="partial content more"
          index={0}
          prevItem={null}
          inProgress={true}
        />
      </Provider>,
    );
    expect(toggle()).toHaveAttribute("aria-expanded", "true");

    rerender(
      <Provider store={store}>
        <ThinkingBlockPeek
          content="partial content more done"
          index={0}
          prevItem={null}
          inProgress={false}
        />
      </Provider>,
    );
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });
});
