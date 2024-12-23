import { usePostHog } from "posthog-js/react";
import { setDialogMessage } from "../../redux/slices/uiSlice";
import { useAppDispatch } from "../../redux/hooks";

export default function FeedbackDialog() {
  const posthog = usePostHog();
  const dispatch = useAppDispatch();

  return (
    <div className="p-4 text-center">
      👋 Thanks for using Continue. We are always trying to improve and love
      hearing from users. If you're interested in speaking, enter your name and
      email. We won't use this information for anything other than reaching out.
      <br />
      <br />
      <form
        onSubmit={(e: any) => {
          e.preventDefault();
          posthog?.capture("user_interest_form", {
            name: e.target.elements[0].value,
            email: e.target.elements[1].value,
          });
          dispatch(
            setDialogMessage(
              <div className="p-4 text-center">
                Thanks! We'll be in touch soon.
              </div>,
            ),
          );
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <input
          style={{ padding: "10px", borderRadius: "5px" }}
          type="text"
          name="name"
          placeholder="Name"
          required
        />
        <input
          style={{ padding: "10px", borderRadius: "5px" }}
          type="email"
          name="email"
          placeholder="Email"
          required
        />
        <button
          style={{
            padding: "10px",
            borderRadius: "5px",
            cursor: "pointer",
          }}
          type="submit"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
