import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useAppSelector } from "../../../../redux/hooks";

export function ErrorSection() {
  const configError = useAppSelector((state) => state.config.configError);

  const sortedErrors = configError
    ? [...configError].sort((a, b) => (b.fatal ? 1 : 0) - (a.fatal ? 1 : 0))
    : [];

  return (
    <div className="flex flex-col gap-5 p-2">
      <ul className="m-0 list-none space-y-4 p-0">
        {sortedErrors.map((error, index) => (
          <li
            key={index}
            className={`flex items-start rounded-md p-2 text-sm shadow-md ${
              error.fatal
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {error.fatal ? (
              <ExclamationCircleIcon className="mr-2 h-5 w-5" />
            ) : (
              <ExclamationTriangleIcon className="mr-2 h-5 w-5" />
            )}
            <p className="m-0 whitespace-pre-wrap">
              <strong>{error.fatal ? "Fatal Error:" : "Warning:"}</strong>{" "}
              {error.message}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
