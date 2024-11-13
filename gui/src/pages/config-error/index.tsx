import {
  ArrowLeftIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { vscBackground } from "../../components";
import { ROUTES } from "../../util/navigation";
import { useConfigError } from "../../redux/hooks";

export default function ConfigErrorPage() {
  const navigate = useNavigate();
  const configError = useConfigError();

  const sortedErrors = configError
    ? [...configError].sort((a, b) => (b.fatal ? 1 : 0) - (a.fatal ? 1 : 0))
    : [];

  return (
    <div className="overflow-y-scroll">
      <div
        onClick={() => navigate(ROUTES.HOME)}
        className="sticky top-0 m-0 flex cursor-pointer items-center border-0 border-b border-solid border-b-zinc-700 bg-inherit p-0"
        style={{
          backgroundColor: vscBackground,
        }}
      >
        <ArrowLeftIcon className="ml-3 inline-block h-3 w-3 cursor-pointer" />
        <span className="m-2 inline-block text-sm font-bold">Chat</span>
      </div>

      <div className="gap-2 divide-x-0 divide-y-2 divide-solid divide-zinc-700 px-4">
        <div className="py-5">
          <h3 className="mb-2 mt-0 text-xl">Config Errors</h3>
          <p className="text-md mb-4">
            Please resolve the following errors in your config.json file.
          </p>
          <div className="flex flex-col gap-5">
            {sortedErrors.length > 0 ? (
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
                    <p className="m-0">
                      <strong>
                        {error.fatal ? "Fatal Error:" : "Warning:"}
                      </strong>{" "}
                      {error.message}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md bg-green-100 p-4 text-sm text-green-700">
                No configuration errors found.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
