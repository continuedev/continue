import { useNavigate } from "react-router-dom";
import { StyledButton } from "./onboarding/components";

function LocalOnboarding() {
  const navigate = useNavigate();

  return (
    <div className="p-2 max-w-96 mt-16 mx-auto">
      <h1 className="text-center">Set up your local LLM</h1>
      <p className="text-center pb-2">
        Let's find the setup that works best for you
      </p>

      <div className="flex">
        <StyledButton
          disabled={false}
          onClick={() => {
            navigate("/");
          }}
        >
          Continue
        </StyledButton>
      </div>
    </div>
  );
}

export default LocalOnboarding;
