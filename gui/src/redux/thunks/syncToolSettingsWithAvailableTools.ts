import { addTool } from "../slices/uiSlice";
import { Tool } from "core";
import { RootState } from "../store";

/**
 * Ensures all available tools are registered in toolSettings.
 * Should be called after the list of available tools (including MCP tools) is updated.
 */
export const syncToolSettingsWithAvailableTools =
  () => (dispatch: any, getState: () => RootState) => {
    // Adjust this selector if your tools are stored elsewhere in Redux
    const availableTools: Tool[] = getState().config?.config?.tools || [];
    const toolSettings = getState().ui.toolSettings;

    for (const tool of availableTools) {
      // Use "in" to respect existing settings, even if value is falsy
      if (!(tool.function.name in toolSettings)) {
        dispatch(addTool(tool));
      }
    }
  };
