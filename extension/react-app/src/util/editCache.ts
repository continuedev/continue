import { useApi } from "../util/api";
import { FileEdit, SerializedDebugContext } from "../../../src/client";
import { useCallback, useEffect, useState } from "react";

export function useEditCache() {
  const { debugApi } = useApi();

  const fetchNewEdit = useCallback(
    async (debugContext: SerializedDebugContext) => {
      return (
        await debugApi?.editEndpointDebugEditPost({
          serializedDebugContext: debugContext,
        })
      )?.completion;
    },
    [debugApi]
  );

  const [editCache, setEditCache] = useState(new EditCache(fetchNewEdit));

  useEffect(() => {
    setEditCache(new EditCache(fetchNewEdit));
  }, [fetchNewEdit]);

  return editCache;
}

/**
 * Stores preloaded edits, invalidating based off of debug context changes
 */
class EditCache {
  private _lastDebugContext: SerializedDebugContext | undefined;
  private _cachedEdits: FileEdit[] | undefined;
  private _fetchNewEdit: (
    debugContext: SerializedDebugContext
  ) => Promise<FileEdit[] | undefined>;
  private _debounceTimer: NodeJS.Timeout | undefined;

  private _debugContextChanged(debugContext: SerializedDebugContext): boolean {
    if (!this._lastDebugContext) {
      return true;
    }

    return (
      JSON.stringify(this._lastDebugContext) !== JSON.stringify(debugContext)
    );
  }

  private _debugContextComplete(debugContext: SerializedDebugContext): boolean {
    return debugContext.rangesInFiles.length > 0;
  }

  public async preloadEdit(debugContext: SerializedDebugContext) {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    if (
      this._debugContextComplete(debugContext) &&
      this._debugContextChanged(debugContext)
    ) {
      this._debounceTimer = setTimeout(async () => {
        console.log("Preloading edits");
        this._cachedEdits = await this._fetchNewEdit(debugContext);
        this._lastDebugContext = debugContext;
      }, 200);
    }
  }

  public async getEdit(
    debugContext: SerializedDebugContext
  ): Promise<FileEdit[]> {
    if (this._debugContextChanged(debugContext)) {
      console.log("Cache miss");
      this._cachedEdits = await this._fetchNewEdit(debugContext);
    } else {
      console.log("Cache hit");
    }

    return this._cachedEdits!;
  }

  constructor(
    fetchNewEdit: (
      debugContext: SerializedDebugContext
    ) => Promise<FileEdit[] | undefined>
  ) {
    this._fetchNewEdit = fetchNewEdit;
  }
}
