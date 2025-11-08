import { usePostHog } from "posthog-js/react";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { useAppDispatch } from "../../redux/hooks";

export default function FeedbackDialog() {
  const posthog = usePostHog();
  const dispatch = useAppDispatch();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <div className="flex items-center gap-2 text-lg font-medium">
        <span>👋</span>
        <span>Help us improve Continue</span>
      </div>

      <p className="text-sm leading-relaxed text-gray-300">
        We're always working to make Continue better and would love to hear from
        you. If you're interested in sharing your experience, please enter your
        details below.
      </p>

      <form
        onSubmit={(e: any) => {
          e.preventDefault();
          posthog?.capture("user_interest_form", {
            name: e.target.elements[0].value,
            email: e.target.elements[1].value,
          });
          dispatch(
            setDialogMessage(
              <div className="p-6 text-center">
                <div className="mb-2 text-lg">✓ Thank you!</div>
                <p className="text-sm text-gray-300">We'll be in touch soon.</p>
              </div>,
            ),
          );

          // Auto-close after 2 seconds
          setTimeout(() => {
            dispatch(setShowDialog(false));
          }, 2000);
        }}
        className="flex flex-col gap-3"
      >
        <input
          className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="text"
          name="name"
          placeholder="Name"
          required
        />
        <input
          className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="email"
          name="email"
          placeholder="Email"
          required
        />
        <div className="mt-2 flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-medium transition-colors hover:bg-blue-700"
          >
            Submit
          </button>
          <button
            type="button"
            onClick={() => dispatch(setShowDialog(false))}
            className="rounded-md bg-gray-700 px-4 py-2 font-medium transition-colors hover:bg-gray-600"
          >
            Not now
          </button>
        </div>
      </form>

      <p className="text-center text-xs text-gray-400">
        We won't use this information for anything other than reaching out.
      </p>
    </div>
  );
}
