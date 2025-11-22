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

const INITIAL_CONFIG_POLLING_INTERVAL = 2_000;
const INITIAL_CONFIG_POLLING_MAX_ATTEMPTS = 100;

function ParallelListeners() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const history = useAppSelector((store) => store.session.history);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const selectedProfileId = useAppSelector(
    (store) => store.profiles.selectedProfileId,
  );

  const hasReceivedOrRetrievedConfig = useRef(false);

  // Load symbols for chat on any session change
  const sessionId = useAppSelector((state) => state.session.id);
  const lastSessionId = useAppSelector((store) => store.session.lastSessionId);
  const [initialSessionId] = useState(sessionId || lastSessionId);

  // Once we know core is up
  const onInitialConfigLoad = useCallback(async () => {
    debugger;
    dispatch(setConfigLoading(false));
    void dispatch(refreshSessionMetadata({}));

    const jetbrains = isJetBrains();
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
          if (result.status === "success") {
            const msg = result.content;
            (window as any).windowId = msg.windowId;
            (window as any).serverUrl = msg.serverUrl;
            (window as any).workspacePaths = msg.workspacePaths;
            (window as any).vscMachineId = msg.vscMachineId;
            (window as any).vscMediaUrl = msg.vscMediaUrl;
          }
        });
    }

    ideMessenger.post("docs/initStatuses", undefined);
    void dispatch(updateFileSymbolsFromHistory());

    if (initialSessionId) {
      await dispatch(
        loadSession({
          sessionId: initialSessionId,
          saveCurrentSession: false,
        }),
      );
    }
  }, [initialSessionId, ideMessenger]);

  const handleConfigUpdate = useCallback(
    async (result: FromCoreProtocol["configUpdate"][0]) => {
      const {
        result: configResult,
        profileId,
        organizations,
        selectedOrgId,
      } = result;
      if (hasReceivedOrRetrievedConfig.current === false) {
        await onInitialConfigLoad();
      }
      hasReceivedOrRetrievedConfig.current = true;
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
    [dispatch, hasReceivedOrRetrievedConfig, onInitialConfigLoad],
  );

  // Startup activity
  useEffect(() => {
    void dispatch(cancelStream());
    dispatch(setIsSessionMetadataLoading(true));
    dispatch(setConfigLoading(true));

    // Local storage migration/jetbrains styles loading
    const jetbrains = isJetBrains();
    setDocumentStylesFromLocalStorage(jetbrains);

    migrateLocalStorage(dispatch);

    // Poll config just to be safe
    async function pollInitialConfigLoad() {
      const result = await ideMessenger.request(
        "config/getSerializedProfileInfo",
        undefined,
      );
      if (result.status === "success") {
        console.log("succeeded", result.content);
        if (hasReceivedOrRetrievedConfig.current === false) {
          await handleConfigUpdate(result.content);
        }
      } else {
        console.log("Failed");
        console.error(result.error);
      }
    }
    void pollInitialConfigLoad();
    let pollAttempts = 0;
    const interval = setInterval(() => {
      if (hasReceivedOrRetrievedConfig.current) {
        clearInterval(interval);
      } else if (pollAttempts >= INITIAL_CONFIG_POLLING_MAX_ATTEMPTS) {
        clearInterval(interval);
        console.warn(
          `Config polling stopped after ${INITIAL_CONFIG_POLLING_MAX_ATTEMPTS} attempts`,
        );
      } else {
        console.log("Config load attempt #" + pollAttempts);
        pollAttempts++;
        void pollInitialConfigLoad();
      }
    }, INITIAL_CONFIG_POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [hasReceivedOrRetrievedConfig, ideMessenger, handleConfigUpdate]);

  // Handle config update events from core
  useWebviewListener(
    "configUpdate",
    async (update) => {
      if (!update) {
        return;
      }
      await handleConfigUpdate(update);
    },
    [handleConfigUpdate],
  );

  useEffect(() => {
    if (sessionId) {
      void dispatch(updateFileSymbolsFromHistory());
    }
  }, [sessionId]);

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

  return <></>;
}

export default ParallelListeners;
