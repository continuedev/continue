import { usePostHog } from "posthog-js/react";
import { Button, Input, SecondaryButton } from "..";
import { useAppDispatch } from "../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";

export default function FeedbackDialog() {
  const posthog = usePostHog();
  const dispatch = useAppDispatch();

  return (
    <div className="mx-auto flex max-w-md flex-col p-6 pt-8">
      <div className="flex items-center gap-2 text-lg font-medium">
        <span>👋</span>
        <span>Help us improve Continue</span>
      </div>

      <p className="text-foreground text-sm leading-relaxed">
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
                <p className="text-foreground text-sm">
                  We'll be in touch soon.
                </p>
              </div>,
            ),
          );

          // Auto-close after 2 seconds
          setTimeout(() => {
            dispatch(setShowDialog(false));
            dispatch(setDialogMessage(undefined));
          }, 2000);
        }}
        className="flex flex-col gap-3"
      >
        <Input type="text" name="name" placeholder="Name" required />
        <Input type="email" name="email" placeholder="Email" required />
        <div className="mt-2 flex justify-between gap-2">
          <SecondaryButton
            className="flex-1"
            type="button"
            onClick={() => {
              dispatch(setShowDialog(false));
              dispatch(setDialogMessage(undefined));
            }}
          >
            Not now
          </SecondaryButton>
          <Button className="flex-1" type="submit">
            Submit
          </Button>
        </div>
      </form>

      <p className="text-description-muted text-xs">
        We'll only use this information to reach out for feedback.
      </p>
    </div>
  );
}
