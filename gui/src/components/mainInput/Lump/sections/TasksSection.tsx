import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { TaskInfo } from "core";
import { useContext, useEffect, useRef, useState } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useFontSize } from "../../../ui/font";

const TaskItem = ({ task }: { task: TaskInfo }) => {
  const smallFont = useFontSize(-2);
  const tinyFont = useFontSize(-3);

  const getStatusIcon = () => {
    switch (task.status) {
      case "completed":
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case "running":
        return <ClockIcon className="h-4 w-4 text-blue-500" />;
      case "pending":
      default:
        return <ExclamationCircleIcon className="h-4 w-4 text-yellow-500" />;
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
    <div className="border-border flex flex-col rounded-sm px-2 py-1.5 transition-colors">
      <div className="flex flex-col">
        <div className="flex flex-row items-center justify-between gap-2">
          <div className="flex flex-1 flex-row items-center gap-2">
            {getStatusIcon()}
            <span
              className="text-vsc-foreground line-clamp-2"
              style={{ fontSize: smallFont }}
            >
              {task.name}
            </span>
          </div>
          <span
            className={`text-xs ${getStatusColor()}`}
            style={{ fontSize: tinyFont }}
          >
            {task.status}
          </span>
        </div>

        {task.description && (
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
        id: "abcd",
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

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <span className="text-gray-400">No tasks found</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  );
}
