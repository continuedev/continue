import { TrashIcon } from "@heroicons/react/24/outline";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { ChatHistoryItem } from "core";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { toggleTodo } from "../../redux/slices/sessionSlice";
import { saveCurrentSession } from "../../redux/thunks/session";
import { useDeleteCompaction } from "../../util/compactConversation";
import { AnimatedEllipsis } from "../AnimatedEllipsis";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";

interface TodoListProps {
  item: ChatHistoryItem;
  index: number;
}

export default function TodoList(props: TodoListProps) {
  const [open, setOpen] = useState(true);
  const dispatch = useAppDispatch();
  const todos = props.item.todos?.todos ?? [];
  const completedCount = todos.filter((t) => t.completed).length;
  const totalCount = todos.length;
  const isLoading = useAppSelector(
    (state) => state.session.compactionLoading[props.index] || false,
  );
  const deleteCompaction = useDeleteCompaction();

  const handleToggleTodo = (todoIndex: number) => {
    dispatch(toggleTodo({ historyIndex: props.index, todoIndex }));
    dispatch(
      saveCurrentSession({
        openNewSession: false,
        generateTitle: false,
      }),
    );
  };

  if (!props.item.todos && !isLoading) {
    return null;
  }

  // Loading state - much simpler
  if (isLoading) {
    return (
      <div className="mx-1.5 mb-4 mt-2">
        <div className="bg-vsc-input-background rounded-md shadow-sm">
          <div className="text-description flex items-center justify-start px-3 py-2 text-xs">
            <span>Generating todos</span>
            <AnimatedEllipsis />
          </div>
        </div>
      </div>
    );
  }

  // Normal state with content
  return (
    <div className="mx-1.5 mb-4 mt-2">
      <div className="bg-vsc-input-background rounded-md shadow-sm">
        <div
          className="text-description flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors duration-200 hover:brightness-105"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <ChevronUpIcon className="h-3 w-3" />
          ) : (
            <ChevronDownIcon className="h-3 w-3" />
          )}
          <span className="flex-1">
            <span className="font-medium">
              [{completedCount}/{totalCount}]
            </span>{" "}
            {props.item.todos?.summary || "Todos"}
          </span>
          <HeaderButtonWithToolTip
            text="Delete todos"
            onClick={(e) => {
              e.stopPropagation();
              deleteCompaction(props.index);
            }}
          >
            <TrashIcon className="text-description-muted h-3 w-3" />
          </HeaderButtonWithToolTip>
        </div>
        {open && (
          <>
            <div className="border-border border-0 border-t border-solid"></div>
            <div className="max-h-[400px] overflow-y-auto px-3 pb-3 pt-2">
              <ul className="mb-2 list-disc space-y-2 pl-1">
                {todos.map((todo, todoIndex) => (
                  <li
                    key={todo.id ?? `${todo.order}-${todo.text}`}
                    className="flex cursor-pointer items-start gap-2"
                    onClick={() => handleToggleTodo(todoIndex)}
                  >
                    <span
                      className={`text-sm ${
                        todo.completed ? "text-gray-400 line-through" : ""
                      }`}
                    >
                      {todo.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
