import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { MockIdeMessenger } from "../../../context/MockIdeMessenger";
import { createMockStore } from "../../../util/test/mockStore";
import { ModelsSection } from "./ModelsSection";

describe("ModelsSection", () => {
  const renderComponent = async (mockMessenger?: MockIdeMessenger) => {
    const { mockIdeMessenger, ...store } = createMockStore({}, mockMessenger);

    const result = await act(async () =>
      render(
        <Provider store={store}>
          <IdeMessengerContext.Provider value={mockIdeMessenger}>
            <AuthProvider>
              <ModelsSection />
            </AuthProvider>
          </IdeMessengerContext.Provider>
        </Provider>,
      ),
    );

    return { ...result, mockIdeMessenger };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders current docs links for chat, autocomplete, and edit", async () => {
    await renderComponent();

    const learnMoreLinks = screen.getAllByRole("link", { name: "Learn more" });
    const hrefs = learnMoreLinks.map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual([
      "https://docs.continue.dev/ide-extensions/chat/quick-start",
      "https://docs.continue.dev/ide-extensions/autocomplete/quick-start",
      "https://docs.continue.dev/ide-extensions/edit/quick-start",
    ]);
  });

  it("opens current setup docs URLs when setup buttons are clicked", async () => {
    const { mockIdeMessenger } = await renderComponent(new MockIdeMessenger());
    const postSpy = vi.spyOn(mockIdeMessenger, "post");

    fireEvent.click(screen.getByRole("button", { name: "Setup Chat model" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Setup Autocomplete model" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Setup Edit model" }));

    expect(postSpy).toHaveBeenCalledTimes(3);
    expect(postSpy).toHaveBeenNthCalledWith(
      1,
      "openUrl",
      "https://docs.continue.dev/ide-extensions/chat/model-setup",
    );
    expect(postSpy).toHaveBeenNthCalledWith(
      2,
      "openUrl",
      "https://docs.continue.dev/ide-extensions/autocomplete/model-setup",
    );
    expect(postSpy).toHaveBeenNthCalledWith(
      3,
      "openUrl",
      "https://docs.continue.dev/ide-extensions/edit/model-setup",
    );
  });
});
