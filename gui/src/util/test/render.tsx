import type { RenderOptions, RenderResult } from "@testing-library/react";
import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { MemoryRouter, RouterProps } from "react-router-dom";
import { MainEditorProvider } from "../../components/mainInput/TipTapEditor";
import { AuthProvider } from "../../context/Auth";
import { IdeMessengerProvider } from "../../context/IdeMessenger";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import ParallelListeners from "../../hooks/ParallelListeners";
import { setupStore } from "../../redux/store";
// As a basic setup, import your same slice reducers

// This type interface extends the default options for render from RTL, as well
// as allows the user to specify other things such as initialState, store.
type ExtendedRenderOptions = Omit<RenderOptions, "queries"> & {
  store?: ReturnType<typeof setupStore>;
  routerProps?: RouterProps;
  mockIdeMessenger?: MockIdeMessenger;
};

function setupMocks() {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}

export async function renderWithProviders(
  ui: React.ReactElement,
  extendedRenderOptions: ExtendedRenderOptions = {},
) {
  setupMocks();
  const ideMessenger =
    extendedRenderOptions?.mockIdeMessenger ?? new MockIdeMessenger();

  const {
    // Automatically create a store instance if no store was passed in
    store = setupStore({
      ideMessenger,
    }),
    routerProps = {},
    ...renderOptions
  } = extendedRenderOptions;

  const user = userEvent.setup();

  const Wrapper = ({ children }: PropsWithChildren) => (
    <MemoryRouter {...routerProps}>
      <IdeMessengerProvider messenger={ideMessenger}>
        <Provider store={store}>
          <AuthProvider>
            <MainEditorProvider>
              {children}
              <ParallelListeners />
            </MainEditorProvider>
          </AuthProvider>
        </Provider>
      </IdeMessengerProvider>
    </MemoryRouter>
  );

  let rendered: RenderResult;
  await act(async () => {
    rendered = render(ui, { wrapper: Wrapper, ...renderOptions });
  });

  // Return an object with the store and all of RTL's query functions
  return {
    user,
    store,
    ideMessenger,
    ...rendered!,
  };
}
