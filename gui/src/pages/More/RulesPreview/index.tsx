import { useAuth } from "../../../context/Auth";

/**
 * Displays a formatted preview of the AI assistant's rules in a code editor style
 */
export function RulesPreview() {
  const { selectedProfile } = useAuth();
  const rules = selectedProfile?.unrolledAssistant?.rules ?? [];

  return (
    <div className="rounded-lg bg-[#1e1e1e] p-6 font-mono text-sm">
      <div className="text-[#d4d4d4]">
        <span className="text-[#c586c0]">rules</span>
        <span className="text-[#d4d4d4]">:</span>

        {rules.map((rule, index) => (
          <div key={index} className="ml-6 mt-2">
            <span className="mr-2 text-[#d4d4d4]">-</span>
            <span
              className="whitespace-pre-wrap text-[#9cdcfe]"
              style={{ maxWidth: "80ch" }}
            >
              {rule}
            </span>
          </div>
        ))}

        {rules.length === 0 && (
          <div className="ml-6 mt-2 italic text-[#6a9955]">
            # No rules defined
          </div>
        )}
      </div>
    </div>
  );
}
