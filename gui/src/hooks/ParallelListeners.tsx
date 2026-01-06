import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";

import { FromCoreProtocol } from "core/protocol";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setConfigLoading, setConfigResult } from "../redux/slices/configSlice";
import { setLastNonEditSessionEmpty } from "../redux/slices/editState";
import { updateIndexingStatus } from "../redux/slices/indexingSlice";
import {
  initializeProfilePreferences,
  setOrganizations,
  setSelectedOrgId,
  setSelectedProfile,
} from "../redux/slices/profilesSlice";
import {
  addContextItemsAtIndex,
  newSession,
  setHasReasoningEnabled,
  setIsSessionMetadataLoading,
  setMode,
} from "../redux/slices/sessionSlice";
import { setTTSActive } from "../redux/slices/uiSlice";

import { modelSupportsReasoning } from "core/llm/autodetect";
import { cancelStream } from "../redux/thunks/cancelStream";
import { handleApplyStateUpdate } from "../redux/thunks/handleApplyStateUpdate";
import { loadSession, refreshSessionMetadata } from "../redux/thunks/session";
import { updateFileSymbolsFromHistory } from "../redux/thunks/updateFileSymbols";
import {
  setDocumentStylesFromLocalStorage,
  setDocumentStylesFromTheme,
} from "../styles/theme";
import { isJetBrains } from "../util";
import { setLocalStorage } from "../util/localStorage";
import { migrateLocalStorage } from "../util/migrateLocalStorage";
import { useWebviewListener } from "./useWebviewListener";

function ParallelListeners() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const history = useAppSelector((store) => store.session.history);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const selectedProfileId = useAppSelector(
    (store) => store.profiles.selectedProfileId,
  );
  const hasDoneInitialConfigLoad = useRef(false);

  // Load symbols for chat on any session change
  const sessionId = useAppSelector((state) => state.session.id);
  const lastSessionId = useAppSelector((store) => store.session.lastSessionId);
  const [initialSessionId] = useState(sessionId || lastSessionId);

  const handleConfigUpdate = useCallback(
    async (isInitial: boolean, result: FromCoreProtocol["configUpdate"][0]) => {
      const {
        result: configResult,
        profileId,
        organizations,
        selectedOrgId,
      } = result;
      if (isInitial && hasDoneInitialConfigLoad.current) {
        return;
      }
      hasDoneInitialConfigLoad.current = true;
      dispatch(setOrganizations(organizations));
      dispatch(setSelectedOrgId(selectedOrgId));
      dispatch(setSelectedProfile(profileId));
      dispatch(setConfigResult(configResult));

      const isNewProfileId = profileId && profileId !== selectedProfileId;

      if (isNewProfileId) {
        dispatch(
          initializeProfilePreferences({
            defaultSlashCommands: [],
            profileId,
          }),
        );
      }

      // Perform any actions needed with the config
      if (configResult.config?.ui?.fontSize) {
        setLocalStorage("fontSize", configResult.config.ui.fontSize);
        document.body.style.fontSize = `${configResult.config.ui.fontSize}px`;
      }

      const chatModel = configResult.config?.selectedModelByRole.chat;
      const supportsReasoning = modelSupportsReasoning(chatModel);
      const isReasoningDisabled =
        chatModel?.completionOptions?.reasoning === false;
      dispatch(
        setHasReasoningEnabled(supportsReasoning && !isReasoningDisabled),
      );
    },
    [dispatch, hasDoneInitialConfigLoad, selectedProfileId],
  );

  // Load config from the IDE
  useEffect(() => {
    async function initialLoadConfig() {
      dispatch(setIsSessionMetadataLoading(true));
      dispatch(setConfigLoading(true));
      const result = await ideMessenger.request(
        "config/getSerializedProfileInfo",
        undefined,
      );
      if (result.status === "success") {
        await handleConfigUpdate(true, result.content);
      }
      dispatch(setConfigLoading(false));
      if (initialSessionId) {
        await dispatch(
          loadSession({
            sessionId: initialSessionId,
            saveCurrentSession: false,
          }),
        );
      }
    }
    void initialLoadConfig();
    const interval = setInterval(() => {
      if (hasDoneInitialConfigLoad.current) {
        // Init to run on initial config load
        ideMessenger.post("docs/initStatuses", undefined);
        void dispatch(updateFileSymbolsFromHistory());
        void dispatch(refreshSessionMetadata({}));

        // This triggers sending pending status to the GUI for relevant docs indexes
        clearInterval(interval);
      } else {
        void initialLoadConfig();
      }
    }, 2_000);

    return () => clearInterval(interval);
  }, [hasDoneInitialConfigLoad, ideMessenger, initialSessionId]);

  useWebviewListener(
    "configUpdate",
    async (update) => {
      if (!update) {
        return;
      }
      await handleConfigUpdate(false, update);
    },
    [handleConfigUpdate],
  );

  useEffect(() => {
    if (sessionId) {
      void dispatch(updateFileSymbolsFromHistory());
    }
  }, [sessionId]);

  // ON LOAD
  useEffect(() => {
    // Override persisted state
    void dispatch(cancelStream());

    const jetbrains = isJetBrains();
    setDocumentStylesFromLocalStorage(jetbrains);

    if (jetbrains) {
      // Save theme colors to local storage for immediate loading in JetBrains
      void ideMessenger
        .request("jetbrains/getColors", undefined)
        .then((result) => {
          if (result.status === "success") {
            setDocumentStylesFromTheme(result.content);
          }
        });

      // Tell JetBrains the webview is ready
      void ideMessenger
        .request("jetbrains/onLoad", undefined)
        .then((result) => {
          if (result.status === "error") {
            return;
          }

          const msg = result.content;
          (window as any).windowId = msg.windowId;
          (window as any).serverUrl = msg.serverUrl;
          (window as any).workspacePaths = msg.workspacePaths;
          (window as any).vscMachineId = msg.vscMachineId;
          (window as any).vscMediaUrl = msg.vscMediaUrl;
        });
    }
  }, []);

  useWebviewListener(
    "jetbrains/setColors",
    async (data) => {
      setDocumentStylesFromTheme(data);
    },
    [],
  );

  // IDE event listeners
  useWebviewListener(
    "getWebviewHistoryLength",
    async () => {
      return history.length;
    },
    [history],
  );

  useWebviewListener(
    "getCurrentSessionId",
    async () => {
      return sessionId;
    },
    [sessionId],
  );

  useWebviewListener("setInactive", async () => {
    void dispatch(cancelStream());
  });

  useWebviewListener("loadAgentSession", async (data) => {
    dispatch(newSession(data.session));
    dispatch(setMode("agent"));
  });

  useWebviewListener("setTTSActive", async (status) => {
    dispatch(setTTSActive(status));
  });

  useWebviewListener("addContextItem", async (data) => {
    dispatch(
      addContextItemsAtIndex({
        index: data.historyIndex,
        contextItems: [data.item],
      }),
    );
  });

  useWebviewListener("indexing/statusUpdate", async (data) => {
    dispatch(updateIndexingStatus(data));
  });

  useWebviewListener(
    "updateApplyState",
    async (state) => {
      void dispatch(handleApplyStateUpdate(state));
    },
    [],
  );

  useEffect(() => {
    if (!isInEdit) {
      dispatch(setLastNonEditSessionEmpty(history.length === 0));
    }
  }, [isInEdit, history]);

  useEffect(() => {
    migrateLocalStorage(dispatch);
  }, []);

  return <></>;
}

export default ParallelListeners;
