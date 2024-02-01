import { createContext } from "react";
import { useDispatch } from "react-redux";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import Layout from "./components/Layout";
import useSetup from "./hooks/useSetup";
import ErrorPage from "./pages/error";
import GUI from "./pages/gui";
import { default as Help, default as HelpPage } from "./pages/help";
import History from "./pages/history";
import MigrationPage from "./pages/migration";
import ModelConfig from "./pages/modelconfig";
import Models from "./pages/models";
import MonacoPage from "./pages/monaco";
import SettingsPage from "./pages/settings";

import { ContextSubmenuItem } from "core";
import useSubmenuContextProviders from "./hooks/useSubmenuContextProviders";

const router = createMemoryRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "/index.html",
        element: <GUI />,
      },
      {
        path: "/",
        element: <GUI />,
      },
      {
        path: "/history",
        element: <History />,
      },
      {
        path: "/help",
        element: <Help />,
      },
      {
        path: "/settings",
        element: <SettingsPage />,
      },
      {
        path: "/models",
        element: <Models />,
      },
      {
        path: "/help",
        element: <HelpPage />,
      },
      {
        path: "/modelconfig/:modelName",
        element: <ModelConfig />,
      },
      {
        path: "/monaco",
        element: <MonacoPage />,
      },
      {
        path: "/migration",
        element: <MigrationPage />,
      },
    ],
  },
]);

export const SubmenuContextProvidersContext = createContext<{
  getSubmenuContextItems: (
    providerTitle: string | undefined,
    query: string
  ) => ContextSubmenuItem[];
  addItem: (providerTitle: string, item: ContextSubmenuItem) => void;
}>({
  getSubmenuContextItems: () => [],
  addItem: () => {},
});

function App() {
  const dispatch = useDispatch();

  useSetup(dispatch);

  const submenuContextProvidersMethods = useSubmenuContextProviders();

  return (
    <SubmenuContextProvidersContext.Provider
      value={submenuContextProvidersMethods}
    >
      <RouterProvider router={router} />
    </SubmenuContextProvidersContext.Provider>
  );
}

export default App;
