import {
  CheckIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { TaskInfo } from "core";
import { useContext, useEffect, useRef, useState } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { cn } from "../../../../util/cn";
import { useFontSize } from "../../../ui/font";

const TaskItem = ({ task }: { task: TaskInfo }) => {
  const ideMessenger = useContext(IdeMessengerContext);
  const smallFont = useFontSize(-2);
  const tinyFont = useFontSize(-3);

  const [editedTask, setEditedTask] = useState({
    name: "",
    description: "",
    isEditing: false,
  });

  const handleRunTask = () => {
    window.postMessage(
      {
        messageType: "userInput",
        data: {
          input: `Please execute the task with name "${task.name}" and mark it as completed when done.`,
        },
      },
      "*",
    );
  };

  const handleDeleteTask = () => {
    void ideMessenger.request("taskList/remove", {
      taskId: task.id,
      sessionId: "abcd",
    });
  };

  const handleEditTask = () => {
    if (editedTask.isEditing) {
      void ideMessenger.request("taskList/update", {
        sessionId: "abcd",
        task: {
          ...task,
          name: editedTask.name,
          description: editedTask.description,
        },
      });
      setEditedTask({
        name: "",
        description: "",
        isEditing: false,
      });
    } else {
      setEditedTask({ ...task, isEditing: true });
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case "completed":
        return "text-green-500";
      case "running":
        return "text-blue-500";
      case "pending":
      default:
        return "text-yellow-500";
    }
  };

  return (
    <div className="border-border flex flex-col rounded-sm px-2 py-0.5 transition-colors">
      <div className="flex flex-col">
        <div className="flex flex-row items-center justify-between gap-2">
          <div className="flex flex-1 flex-row items-center gap-2">
            {editedTask.isEditing ? (
              <input
                className="bg-input text-input-foreground border-input-border placeholder:text-input-placeholder focus:border-border-focus flex-grow rounded-md border border-solid p-1 focus:outline-none"
                value={editedTask.name}
                onChange={(e) =>
                  setEditedTask((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            ) : (
              <span
                className="text-vsc-foreground line-clamp-2"
                style={{ fontSize: smallFont }}
              >
                {task.name}
              </span>
            )}
          </div>
          <div className="flex flex-row items-center gap-2">
            <div
              className="text-lightgray flex cursor-pointer items-center hover:opacity-80"
              onClick={handleRunTask}
              title="Run Task"
            >
              <PlayIcon className="h-3 w-3" />
            </div>
            <div
              className={cn(
                "text-lightgray flex cursor-pointer items-center hover:opacity-80",
                editedTask.isEditing && "text-success",
              )}
              onClick={handleEditTask}
              title="Edit Task"
            >
              {editedTask.isEditing ? (
                <CheckIcon className="h-3 w-3" />
              ) : (
                <PencilIcon className="h-3 w-3" />
              )}
            </div>
            <div
              className="text-lightgray flex cursor-pointer items-center hover:opacity-80"
              onClick={handleDeleteTask}
              title="Delete Task"
            >
              <TrashIcon className="h-3 w-3" />
            </div>
            <span
              className={`text-xs ${getStatusColor()}`}
              style={{ fontSize: tinyFont }}
            >
              {task.status}
            </span>
          </div>
        </div>

        {editedTask.isEditing ? (
          <textarea
            className="bg-input text-input-foreground border-input-border placeholder:text-input-placeholder focus:border-border-focus field-sizing-content mt-1 h-full resize-none rounded-md border border-solid p-1 font-[family-name:var(--vscode-font-family)] focus:outline-none"
            value={editedTask.description}
            onChange={(e) =>
              setEditedTask((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
          />
        ) : (
          <span
            style={{ fontSize: tinyFont }}
            className="mt-1 line-clamp-3 text-gray-400"
          >
            {task.description}
          </span>
        )}
      </div>
    </div>
  );
};

export function TasksSection() {
  const ideMessenger = useContext(IdeMessengerContext);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const fetchTaskIntervalRef = useRef<NodeJS.Timeout | null>();

  const handleAddTask = () => {
    // TODO: Implement add task functionality
  };

  // useWebviewListener(
  //   "taskEvent",
  //   async (data) => {
  //     console.log("debug1 updated task event", data);
  //     setTasks(data.tasks);
  //   },
  //   [],
  // );

  useEffect(() => {
    const fetchTasks = async () => {
      const response = await ideMessenger.request("taskList/list", {
        sessionId: "abcd",
      });
      if (response.status === "success") {
        setTasks(response.content);
      }
    };
    fetchTaskIntervalRef.current = setInterval(() => {
      void fetchTasks();
    }, 1000);

    void fetchTasks();

    return () => {
      if (fetchTaskIntervalRef.current) {
        clearInterval(fetchTaskIntervalRef.current);
      }
    };
  }, [ideMessenger]);

  return (
    <div className="mt-1 flex flex-col gap-2">
      <div className="ml-auto flex items-center gap-x-2">
        <div
          className="text-lightgray flex cursor-pointer items-center hover:opacity-80"
          // onClick={handleRunTask}
          title="Add Task"
        >
          <PlusIcon className="h-3 w-3" />
        </div>
        <div
          className="text-lightgray flex cursor-pointer items-center hover:opacity-80"
          // onClick={handleRunTask}
          title="Run all tasks"
        >
          <PlayIcon className="h-3 w-3" />
        </div>
      </div>
      {tasks.length === 0 ? (
        <div className="flex items-center justify-center pb-0.5">
          <span className="text-gray-400">No tasks found</span>
        </div>
      ) : (
        tasks.map((task) => <TaskItem key={task.id} task={task} />)
      )}
    </div>
  );
}
