import { useNavigate } from "react-router-dom";
import ContinueButton from "../components/mainInput/ContinueButton";

function MigrationPage() {
  const navigate = useNavigate();
  return (
    <div className="p-8">
      <h1>
        Migration to <code>config.json</code>
      </h1>

      <p>
        Continue now uses a .json config file. We hope that this takes the
        guesswork out of setting up.
      </p>

      <p>
        Your configuration should have been automatically migrated, but we
        recommend double-checking that everything looks correct.
      </p>

      <p>
        For a summary of what changed and examples of <code>config.json</code>,
        please see the{" "}
        <a href="https://docs.continue.dev/walkthroughs/config-file-migration">
          migration walkthrough
        </a>
        , and if you have any questions please reach out to us on{" "}
        <a href="https://discord.gg/Y83xkG3uUW">Discord</a>.
      </p>

      <i>
        Note: If you are running the server manually and have not updated the
        server, this message does not apply.
      </i>

      <ContinueButton
        showStop={false}
        onClick={() => {
          navigate("/");
        }}
        disabled={false}
      />
    </div>
  );
}

export default MigrationPage;
