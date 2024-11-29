import { useDispatch } from "react-redux";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import Layout from "./components/Layout";
import { VscThemeProvider } from "./context/VscTheme";
import useSetup from "./hooks/useSetup";
import { AddNewModel, ConfigureProvider } from "./pages/AddNewModel";
import ConfigErrorPage from "./pages/config-error";
import Edit from "./pages/edit";
import ErrorPage from "./pages/error";
import Chat from "./pages/gui";
import History from "./pages/history";
import MigrationPage from "./pages/migration";
import MonacoPage from "./pages/monaco";
import MorePage from "./pages/More";
import SettingsPage from "./pages/settings";
import Stats from "./pages/stats";
import { ROUTES } from "./util/navigation";
import { SubmenuContextProvidersProvider } from "./context/SubmenuContextProviders";

const router = createMemoryRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "/index.html",
        element: <Chat />,
      },
      {
        path: "/",
        element: <Chat />,
      },
      {
        path: "/edit",
        element: <Edit />,
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

/*
  Prevents entire app from rerendering continuously with useSetup in App
  TODO - look into a more redux-esque way to do this
*/
function SetupListeners() {
  const dispatch = useDispatch();

  useSetup(dispatch);
  return <></>;
}

function App() {
  return (
    <VscThemeProvider>
      <SubmenuContextProvidersProvider>
        <RouterProvider router={router} />
      </SubmenuContextProvidersProvider>
      <SetupListeners />
    </VscThemeProvider>
  );
}

export default App;
