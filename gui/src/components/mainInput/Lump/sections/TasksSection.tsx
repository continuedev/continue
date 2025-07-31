import { TaskInfo } from "core";
import { useContext, useEffect, useRef, useState } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useFontSize } from "../../../ui/font";

const TaskItem = ({ task }: { task: TaskInfo }) => {
  const smallFont = useFontSize(-2);
  const tinyFont = useFontSize(-3);

  const getStatusColor = () => {
    switch (task.status) {
      case "completed":
        return "text-green-500";
      case "pending":
      default:
        return "text-yellow-500";
    }
  };

  return (
    <div className="border-border flex flex-col rounded-sm px-2 py-0.5 transition-colors">
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-vsc-foreground line-clamp-2"
            style={{ fontSize: smallFont }}
          >
            {task.name}
          </span>

          <span
            className={`text-xs ${getStatusColor()}`}
            style={{ fontSize: tinyFont }}
          >
            {task.status}
          </span>
        </div>

        <span
          style={{ fontSize: tinyFont }}
          className="mt-1 line-clamp-3 text-gray-400"
        >
          {task.description}
        </span>
      </div>
    </div>
  );
};

export function TasksSection() {
  const ideMessenger = useContext(IdeMessengerContext);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const fetchTaskIntervalRef = useRef<NodeJS.Timeout | null>();

  useEffect(() => {
    const fetchTasks = async () => {
      const response = await ideMessenger.request("taskList/list", undefined);
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
