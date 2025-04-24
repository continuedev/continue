import type { RenderOptions, RenderResult } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { MemoryRouter, RouterProps } from "react-router-dom";
import { AuthProvider } from "../../context/Auth";
import { IdeMessengerProvider } from "../../context/IdeMessenger";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import { setupStore } from "../../redux/store";
import { SetupListeners } from "../../App";
import { act } from "@testing-library/react";
// As a basic setup, import your same slice reducers

// This type interface extends the default options for render from RTL, as well
// as allows the user to specify other things such as initialState, store.
type ExtendedRenderOptions = Omit<RenderOptions, "queries"> & {
  store?: ReturnType<typeof setupStore>;
  routerProps?: RouterProps;
};

export function renderWithProviders(
  ui: React.ReactElement,
  extendedRenderOptions: ExtendedRenderOptions = {},
) {
  const ideMessenger = new MockIdeMessenger();

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
            {children}
            <SetupListeners />
          </AuthProvider>
        </Provider>
      </IdeMessengerProvider>
    </MemoryRouter>
  );

  let rendered: RenderResult;
  act(() => {
    rendered = render(ui, { wrapper: Wrapper, ...renderOptions });
  });

  // Return an object with the store and all of RTL's query functions
  return {
    user,
    store,
    ...rendered!,
  };
}
