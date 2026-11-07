import type { CatalogListEntry } from "core/config/yaml/saveModelRoles";
import { useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppSelector } from "../redux/hooks";

/**
 * The model catalog (models.yaml): each model and each variant, read again
 * whenever the config reloads (a save of models.yaml reloads it).
 */
export function useModelCatalog(): CatalogListEntry[] {
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);
  const [catalog, setCatalog] = useState<CatalogListEntry[]>([]);
  useEffect(() => {
    let cancelled = false;
    void ideMessenger
      .request("models/catalog", undefined)
      .then((res) => {
        if (!cancelled && res.status === "success") setCatalog(res.content);
      })
      .catch(() => {
        // Without the catalog the tables show the config's models only
      });
    return () => {
      cancelled = true;
    };
  }, [ideMessenger, config]);
  return catalog;
}
