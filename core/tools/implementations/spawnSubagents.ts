import { ContextItem } from "../..";
import {
  runSubagent,
  SubagentProgress,
  SubagentTask,
} from "../../agent/subagentRunner";
import { SUBAGENT_MAX_CONCURRENCY } from "../constants";
import { ToolImpl } from ".";

function parseTasks(args: any): SubagentTask[] {
  const raw = args?.tasks;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(
      "`tasks` must be a non-empty array of { description, prompt } objects.",
    );
  }

  return raw.map((task: any, i: number) => {
    if (typeof task?.description !== "string" || !task.description.trim()) {
      throw new Error(`tasks[${i}].description must be a non-empty string.`);
    }
    if (typeof task?.prompt !== "string" || !task.prompt.trim()) {
      throw new Error(`tasks[${i}].prompt must be a non-empty string.`);
    }
    return {
      description: task.description.trim(),
      prompt: task.prompt,
      allowed_tools: Array.isArray(task.allowed_tools)
        ? task.allowed_tools.filter((t: unknown) => typeof t === "string")
        : undefined,
      model: typeof task.model === "string" ? task.model : undefined,
    };
  });
}

function statusLabel(progress: SubagentProgress): string {
  switch (progress.status) {
    case "running":
      return progress.iterations > 0
        ? `Working (step ${progress.iterations})`
        : "Starting";
    case "done":
      return "Done";
    case "errored":
      return "Failed";
    case "canceled":
      return "Canceled";
  }
}

function toContextItem(
  task: SubagentTask,
  progress: SubagentProgress,
): ContextItem {
  return {
    name: task.description,
    description: statusLabel(progress),
    // The live transcript while running; the final report once finished, since
    // that's what actually matters to the reader afterwards.
    content:
      progress.status === "done" && progress.report
        ? progress.report
        : progress.transcript || "_Starting…_",
    status: progress.status,
  };
}

/**
 * Runs every task in one call concurrently. Fanning out from a single tool call
 * (rather than relying on the model to emit N parallel tool calls) is
 * deliberate: it doesn't depend on the model batching calls, on delta
 * index handling, or on the GUI dispatching pending calls in parallel.
 */
export const spawnSubagentsImpl: ToolImpl = async (args, extras) => {
  if ((extras.subagentDepth ?? 0) > 0) {
    throw new Error(
      "Subagents cannot spawn further subagents. Complete this task yourself with the tools you have.",
    );
  }

  const tasks = parseTasks(args);

  const progressByIndex: SubagentProgress[] = tasks.map(() => ({
    status: "running",
    iterations: 0,
    transcript: "",
  }));

  const publish = () => {
    if (!extras.onPartialOutput || !extras.toolCallId) {
      return;
    }
    extras.onPartialOutput({
      toolCallId: extras.toolCallId,
      contextItems: tasks.map((task, i) =>
        toContextItem(task, progressByIndex[i]),
      ),
    });
  };

  publish();

  // Bounded concurrency: each subagent may be a whole `claude` subprocess, so
  // an over-eager model asking for 20 at once shouldn't fork 20 processes.
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(SUBAGENT_MAX_CONCURRENCY, tasks.length) },
    async () => {
      while (nextIndex < tasks.length) {
        const index = nextIndex++;
        progressByIndex[index] = await runSubagent({
          task: tasks[index],
          llm: extras.llm,
          config: extras.config,
          ide: extras.ide,
          fetch: extras.fetch,
          codeBaseIndexer: extras.codeBaseIndexer,
          sessionId: extras.sessionId,
          signal: extras.signal,
          requestApproval: extras.requestApproval,
          onProgress: (progress) => {
            progressByIndex[index] = progress;
            publish();
          },
        });
        publish();
      }
    },
  );

  await Promise.all(workers);

  return tasks.map((task, i) => toContextItem(task, progressByIndex[i]));
};
