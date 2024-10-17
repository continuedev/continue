import { useDispatch } from "react-redux";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import Layout from "./components/Layout";
import { SubmenuContextProvidersContext } from "./context/SubmenuContextProviders";
import { VscThemeContext } from "./context/VscTheme";
import useSetup from "./hooks/useSetup";
import useSubmenuContextProviders from "./hooks/useSubmenuContextProviders";
import { useVscTheme } from "./hooks/useVscTheme";
import { AddNewModel, ConfigureProvider } from "./pages/AddNewModel";
import ErrorPage from "./pages/error";
import GUI from "./pages/gui";
import History from "./pages/history";
import MigrationPage from "./pages/migration";
import MonacoPage from "./pages/monaco";
import MorePage from "./pages/More";
import SettingsPage from "./pages/settings";
import Stats from "./pages/stats";
import { ROUTES } from "./util/navigation";
import ConfigErrorPage from "./pages/config-error";

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
        path: "/stats",
        element: <Stats />,
      },
      {
        path: "/settings",
        element: <SettingsPage />,
      },
      {
        path: "/addModel",
        element: <AddNewModel />,
      },
      {
        path: "/addModel/provider/:providerName",
        element: <ConfigureProvider />,
      },
      {
        path: "/more",
        element: <MorePage />,
      },
      {
        path: ROUTES.CONFIG_ERROR,
        element: <ConfigErrorPage />,
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

function App() {
  const dispatch = useDispatch();

  useSetup(dispatch);

  const vscTheme = useVscTheme();
  const submenuContextProvidersMethods = useSubmenuContextProviders();

  return (
    <VscThemeContext.Provider value={vscTheme}>
      <SubmenuContextProvidersContext.Provider
        value={submenuContextProvidersMethods}
      >
        <RouterProvider router={router} />
      </SubmenuContextProvidersContext.Provider>
    </VscThemeContext.Provider>
  );
}

export default App;
