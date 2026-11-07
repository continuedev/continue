import { createAsyncThunk } from "@reduxjs/toolkit";
import { planBuildMessage, taskPlanFromPlanFile } from "core/util/planFile";
import { findUriInDirs } from "core/util/uri";
import { setMode, setTaskPlan } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { streamResponseThunk } from "./streamResponse";

/** The path shown to the model: workspace-relative when it can be. */
async function displayPath(
  fileUri: string,
  getWorkspaceDirs: () => Promise<string[]>,
): Promise<string> {
  try {
    const { relativePathOrBasename, foundInDir } = findUriInDirs(
      fileUri,
      await getWorkspaceDirs(),
    );
    return foundInDir ? relativePathOrBasename : fileUri;
  } catch {
    return fileUri;
  }
}

/**
 * Build on a plan card: read the plan file back (the person may have edited
 * it) and make its checkboxes the task list, switch to Agent mode, and send
 * the message that tells the model to implement the plan.
 *
 * A file that cannot be read or whose to-dos break the list rules leaves the
 * current list as it is; the message still tells the model to read the file.
 */
export const buildPlan = createAsyncThunk<
  void,
  { planFile: string },
  ThunkApiType
>("plan/build", async ({ planFile }, { dispatch, getState, extra }) => {
  const ide = extra.ideMessenger.ide;
  try {
    const markdown = await ide.readFile(planFile);
    const result = taskPlanFromPlanFile(markdown, getState().session.taskPlan);
    if (result.ok) {
      dispatch(setTaskPlan(result.plan));
    } else {
      console.warn(`Plan file to-dos not used: ${result.error}`);
    }
  } catch (e) {
    console.warn("Could not read the plan file", e);
  }

  dispatch(setMode("agent"));

  const text = planBuildMessage(
    await displayPath(planFile, () => ide.getWorkspaceDirs()),
  );
  await dispatch(
    streamResponseThunk({
      editorState: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text }] }],
      },
      modifiers: { noContext: true, useCodebase: false },
    }),
  );
});
