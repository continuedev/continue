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
        className="items-center flex m-0 p-0 sticky top-0 cursor-pointer border-0 border-b border-solid border-b-zinc-700 bg-inherit"
        style={{
          backgroundColor: vscBackground,
        }}
      >
        <ArrowLeftIcon className="inline-block ml-3 cursor-pointer w-3 h-3" />
        <span className="text-sm font-bold m-2 inline-block">Chat</span>
      </div>

      <div className="px-4 divide-y-2 divide-zinc-700 divide-solid divide-x-0 gap-2">
        <div className="py-5">
          <h3 className="text-xl mb-2 mt-0">Config Errors</h3>
          <p className="mb-4 text-md">
            Please resolve the following errors in your config.json file.
          </p>
          <div className="flex flex-col gap-5">
            {sortedErrors.length > 0 ? (
              <ul className="list-none space-y-4 p-0 m-0">
                {sortedErrors.map((error, index) => (
                  <li
                    key={index}
                    className={`text-sm p-2 rounded-md shadow-md flex items-start ${
                      error.fatal
                        ? "text-red-800 bg-red-100"
                        : "text-yellow-800 bg-yellow-100"
                    }`}
                  >
                    {error.fatal ? (
                      <ExclamationCircleIcon className="w-5 h-5 mr-2" />
                    ) : (
                      <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
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
              <p className="text-sm text-green-700 bg-green-100 p-4 rounded-md">
                No configuration errors found.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
