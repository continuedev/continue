import GUI from "./pages/gui";
import History from "./pages/history";
import Help from "./pages/help";
import Layout from "./components/Layout";
import { createContext } from "react";
import useContinueGUIProtocol from "./hooks/useContinueClient";
import ContinueGUIClientProtocol from "./client/ContinueGUIClientProtocol";
import { useDispatch } from "react-redux";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import ErrorPage from "./pages/error";
import SettingsPage from "./pages/settings";
import Models from "./pages/models";
import HelpPage from "./pages/help";
import ModelConfig from "./pages/modelconfig";
import useSetup from "./hooks/useSetup";
import MonacoPage from "./pages/monaco";

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
    ],
  },
]);

export const GUIClientContext = createContext<
  ContinueGUIClientProtocol | undefined
>(undefined);

function App() {
  const client = useContinueGUIProtocol(false);
  const dispatch = useDispatch();

  useSetup(client, dispatch);

  return (
    <GUIClientContext.Provider value={client}>
      <RouterProvider router={router} />
    </GUIClientContext.Provider>
  );
}

export default App;
