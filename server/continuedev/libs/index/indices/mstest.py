from meilisearch_python_async import Client


async def add_docs():
    async with Client("http://localhost:7700") as search_client:
        index = await search_client.create_index("UsersnatesestiDesktopcontinueguisrc")
        await index.delete_all_documents()
        return
        await index.add_documents(
            [
                {
                    "id": 0,
                    "content": 'import GUI from "./pages/gui";\nimport History from "./pages/history";\nimport Help from "./pages/help";\nimport Layout from "./components/Layout";\nimport { createContext, useEffect } from "react";\nimport useContinueGUIProtocol from "./hooks/useWebsocket";\nimport ContinueGUIClientProtocol from "./hooks/ContinueGUIClientProtocol";\nimport { useDispatch } from "react-redux";\nimport {\n  setApiUrl,\n  setVscMachineId,\n  setSessionId,\n  setVscMediaUrl,\n  setDataSwitchOn,\n  setWorkspacePaths,\n} from "./redux/slices/configSlice";\nimport {\n  setHighlightedCode,\n  setServerStatusMessage,\n} from "./redux/slices/miscSlice";\nimport { postVscMessage } from "./vscode";\nimport { RouterProvider, createMemoryRouter } from "react-router-dom";\nimport ErrorPage from "./pages/error";\nimport SettingsPage from "./pages/settings";\nimport Models from "./pages/models";\nimport HelpPage from "./pages/help";\nimport ModelConfig from "./pages/modelconfig";\nimport { usePostHog } from "posthog-js/react";\n\nconst router = createMemoryRouter([\n  {\n    path: "/",\n    element: <Layout />,\n    errorElement: <ErrorPage />,\n    children: [\n      {\n        path: "/index.html",\n        element: <GUI />,\n      },\n      {\n        path: "/",\n        element: <GUI />,\n      },\n      {\n        path: "/history",\n        element: <History />,\n      },\n      {\n        path: "/help",\n        element: <Help />,\n      },\n      {\n        path: "/settings",\n        element: <SettingsPage />,\n      },\n      {\n        path: "/models",\n        element: <Models />,\n      },\n      {\n        path: "/help",\n        element: <HelpPage />,\n      },\n      {\n        path: "/modelconfig/:modelName",\n        element: <ModelConfig />,\n      },\n    ],\n  },\n]);\n\nexport const GUIClientContext = createContext<\n  ContinueGUIClientProtocol | undefined\n>(undefined);\n\nfunction App() {\n  const client = useContinueGUIProtocol(false);\n  const posthog = usePostHog();\n\n  const dispatch = useDispatch();\n  useEffect(() => {\n    const eventListener = (event: any) => {\n      switch (event.data.type) {\n        case "onLoad":\n          dispatch(setApiUrl(event.data.apiUrl));\n          dispatch(setVscMachineId(event.data.vscMachineId));\n          dispatch(setSessionId(event.data.sessionId));\n',
                    "document_id": "/Users/natesesti/Desktop/continue/gui/src/App.tsx",
                    "metadata": {"start_pos": 0, "end_pos": 10, "index": 0},
                },
                {
                    "id": 1,
                    "content": '          dispatch(setVscMediaUrl(event.data.vscMediaUrl));\n          dispatch(setDataSwitchOn(event.data.dataSwitchOn));\n          if (event.data.uniqueId) {\n            posthog?.identify(event.data.vscMachineId);\n          }\n          dispatch(setWorkspacePaths(event.data.workspacePaths));\n          break;\n        case "highlightedCode":\n          dispatch(setHighlightedCode(event.data.rangeInFile));\n          break;\n        case "serverStatus":\n          dispatch(setServerStatusMessage(event.data.message));\n          break;\n      }\n    };\n    window.addEventListener("message", eventListener);\n    postVscMessage("onLoad", {});\n    return () => window.removeEventListener("message", eventListener);\n  }, []);\n\n  useEffect(() => {\n    if (document.body.style.getPropertyValue("--vscode-editor-foreground")) {\n      localStorage.setItem(\n        "--vscode-editor-foreground",\n        document.body.style.getPropertyValue("--vscode-editor-foreground")\n      );\n    }\n    if (document.body.style.getPropertyValue("--vscode-editor-background")) {\n      localStorage.setItem(\n        "--vscode-editor-background",\n        document.body.style.getPropertyValue("--vscode-editor-background")\n      );\n    }\n    if (document.body.style.getPropertyValue("--vscode-list-hoverBackground")) {\n      localStorage.setItem(\n        "--vscode-list-hoverBackground",\n        document.body.style.getPropertyValue("--vscode-list-hoverBackground")\n      );\n    }\n  }, []);\n\n  return (\n    <GUIClientContext.Provider value={client}>\n      <RouterProvider router={router} />\n    </GUIClientContext.Provider>\n  );\n}\n\nexport default App;\n\n',
                    "document_id": "/Users/natesesti/Desktop/continue/gui/src/App.tsx",
                    # "metadata": {...},
                },
                {
                    "id": 2,
                    "content": '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root {\n  --secondary-dark: rgb(37, 37, 38);\n  --vsc-background: rgb(30, 30, 30);\n  --button-color: rgb(113, 28, 59);\n  --button-color-hover: rgba(113, 28, 59, 0.667);\n  --def-border-radius: 5px;\n\n  --vscode-editor-background: rgb(30, 30, 30);\n  --vscode-editor-foreground: rgb(197, 200, 198);\n  --vscode-textBlockQuote-background: rgba(255, 255, 255, 1);\n}\n\nhtml,\nbody,\n#root {\n  height: 100%;\n  background-color: var(--vscode-editor-background);\n  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,\n    Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;\n}\n\nbody {\n  padding: 0;\n  color: var(--vscode-editor-foreground);\n  padding: 0px;\n  margin: 0px;\n  height: 100%;\n}\n\n.press-start-2p {\n  font-family: "Press Start 2P", sans-serif;\n}\n\na:focus {\n  outline: none;\n}\n\n',
                    "document_id": "/Users/natesesti/Desktop/continue/gui/src/index.css",
                    # "metadata": {...},
                },
                {
                    "id": 3,
                    "content": 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport { Provider } from "react-redux";\nimport store from "./redux/store";\nimport "./index.css";\n\nimport CustomPostHogProvider from "./hooks/CustomPostHogProvider";\n\nReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(\n  <React.StrictMode>\n    <Provider store={store}>\n      <CustomPostHogProvider>\n        <App />\n      </CustomPostHogProvider>\n    </Provider>\n  </React.StrictMode>\n);\n\n',
                    "document_id": "/Users/natesesti/Desktop/continue/gui/src/main.tsx",
                    # "metadata": {...},
                },
            ]
        )


async def query(query: str):
    async with Client("http://localhost:7700") as search_client:
        results = await search_client.index(
            "UsersnatesestiDesktopcontinueguisrc"
        ).search(query, limit=4)
        return results


async def main():
    await add_docs()
    results = await query("import")
    print(results)


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
