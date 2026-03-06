import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createMockStore } from "../../../util/test/mockStore";
import { ModelsSection } from "./ModelsSection";

vi.mock("../../../context/Auth", () => ({
  useAuth: () => ({
    selectedProfile: {
      profileType: "local",
    },
  }),
}));

vi.mock("../../../components/mainInput/Lump/useEditBlock", () => ({
  useEditModel: () => vi.fn(),
}));

vi.mock("../../../components/gui/Shortcut", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../../../components/ui", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Divider: () => <hr />,
  Toggle: ({
    children,
    title,
    subtitle,
  }: {
    children: ReactNode;
    title: string;
    subtitle?: string;
  }) => (
    <section>
      <div>{title}</div>
      {subtitle ? <div>{subtitle}</div> : null}
      {children}
    </section>
  ),
}));

vi.mock("../components/ConfigHeader", () => ({
  ConfigHeader: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("../components/ModelRoleRow", () => ({
  ModelRoleRow: ({
    role,
    description,
    setupURL,
  }: {
    role: string;
    description: ReactNode;
    setupURL: string;
  }) => (
    <div data-testid={`model-role-${role}`}>
      <div>{description}</div>
      <a href={setupURL}>{`${role} setup`}</a>
    </div>
  ),
}));

vi.mock("../../../util", async () => {
  const actual =
    await vi.importActual<typeof import("../../../util")>("../../../util");

  return {
    ...actual,
    getMetaKeyLabel: () => "cmd",
    isJetBrains: () => false,
  };
});

describe("ModelsSection docs links", () => {
  function renderComponent() {
    const { mockIdeMessenger, ...store } = createMockStore();

    render(
      <Provider store={store}>
        <ModelsSection />
      </Provider>,
    );

    return { store, mockIdeMessenger };
  }

  it("uses current ide-extensions docs routes for learn more and setup links", () => {
    renderComponent();

    const learnMoreLinks = screen.getAllByRole("link", { name: "Learn more" });
    const setupLinks = [
      screen.getByRole("link", { name: "chat setup" }),
      screen.getByRole("link", { name: "autocomplete setup" }),
      screen.getByRole("link", { name: "edit setup" }),
    ];

    const hrefs = [...learnMoreLinks, ...setupLinks].map((link) =>
      link.getAttribute("href"),
    );

    expect(hrefs).toEqual([
      "https://docs.continue.dev/ide-extensions/chat/quick-start",
      "https://docs.continue.dev/ide-extensions/autocomplete/quick-start",
      "https://docs.continue.dev/ide-extensions/edit/quick-start",
      "https://docs.continue.dev/ide-extensions/chat/model-setup",
      "https://docs.continue.dev/ide-extensions/autocomplete/model-setup",
      "https://docs.continue.dev/ide-extensions/edit/model-setup",
    ]);

    hrefs.forEach((href) => {
      expect(href).not.toContain("/docs/");
    });
  });
});
