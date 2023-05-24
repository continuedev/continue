import {
  Configuration,
  DebugApi,
  UnittestApi,
  ChatApi,
} from "../../../src/client";
import { useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { RootStore } from "../redux/store";

export function useApi() {
  const apiUrl = useSelector((state: RootStore) => state.config.apiUrl);
  const vscMachineId = useSelector(
    (state: RootStore) => state.config.vscMachineId
  );
  const [debugApi, setDebugApi] = useState<DebugApi>();
  const [unittestApi, setUnittestApi] = useState<UnittestApi>();
  const [chatApi, setChatApi] = useState<ChatApi>();

  useEffect(() => {
    if (apiUrl && vscMachineId) {
      let config = new Configuration({
        basePath: apiUrl,
        fetchApi: fetch,
        middleware: [
          {
            pre: async (context) => {
              context.init.headers = {
                ...context.init.headers,
                "x-vsc-machine-id": vscMachineId,
              };
            },
          },
        ],
      });
      setDebugApi(new DebugApi(config));
      setUnittestApi(new UnittestApi(config));
      setChatApi(new ChatApi(config));
    }
  }, [apiUrl, vscMachineId]);

  return { debugApi, unittestApi, chatApi };
}
