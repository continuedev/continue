import { createContext, useState } from "react";
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

import { ExtensionIde } from "core/ide";
import { getBasename } from "core/util";
import MiniSearch from "minisearch";

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

const filesMiniSearch = new MiniSearch({
  fields: ["id", "basename"],
  storeFields: ["id", "basename"],
});
export const FilesSearchContext = createContext<
  [MiniSearch, MiniSearchResult[]]
>([filesMiniSearch, []]);

const foldersMiniSearch = new MiniSearch({
  fields: ["id", "basename"],
  storeFields: ["id", "basename"],
});
export const FoldersSearchContext = createContext<
  [MiniSearch, MiniSearchResult[]]
>([foldersMiniSearch, []]);

(async () => {
  const files = await new ExtensionIde().listWorkspaceContents();
  const results = files.map((filepath) => {
    return { id: filepath, basename: getBasename(filepath) };
  });
  filesMiniSearch.addAll(results);
})();

(async () => {
  const folders = await new ExtensionIde().listFolders();
  const results = folders.map((path) => {
    return { id: path, basename: getBasename(path) };
  });
  foldersMiniSearch.addAll(results);
})();

export interface MiniSearchResult {
  id: string;
  basename: string;
}

function App() {
  const dispatch = useDispatch();

  useSetup(dispatch);

  const [filesFirstResultsState, setFilesFirstResults] = useState<
    MiniSearchResult[]
  >([]);
  const [foldersFirstResultsState, setFoldersFirstResults] = useState<
    MiniSearchResult[]
  >([]);

  return (
    <FilesSearchContext.Provider
      value={[filesMiniSearch, filesFirstResultsState]}
    >
      <FoldersSearchContext.Provider
        value={[foldersMiniSearch, foldersFirstResultsState]}
      >
        <RouterProvider router={router} />
      </FoldersSearchContext.Provider>
    </FilesSearchContext.Provider>
  );
}

export default App;
