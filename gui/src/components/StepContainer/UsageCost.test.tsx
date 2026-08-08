import { render, screen } from "@testing-library/react";
import { ChatHistoryItem, PromptLog } from "core";
import { describe, expect, it } from "vitest";
import UsageCost from "./UsageCost";

function historyItem(promptLogs?: PromptLog[]): ChatHistoryItem {
  return {
    message: { role: "assistant", content: "hi" },
    contextItems: [],
    promptLogs,
  };
}

const usagePromptLog = (overrides: Partial<PromptLog> = {}): PromptLog => ({
  modelTitle: "Claude Sonnet",
  modelProvider: "anthropic",
  model: "claude-sonnet-4-6",
  prompt: "",
  completion: "",
  usage: { promptTokens: 12_000, completionTokens: 4_000 },
  ...overrides,
});

describe("UsageCost", () => {
  it("renders nothing when there are no prompt logs", () => {
    const { container } = render(<UsageCost item={historyItem()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when usage is unavailable", () => {
    const { container } = render(
      <UsageCost
        item={historyItem([
          {
            modelTitle: "Claude Sonnet",
            modelProvider: "anthropic",
            model: "claude-sonnet-4-6",
            prompt: "",
            completion: "",
          },
        ])}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows model, tokens, and cost for a known model", () => {
    render(<UsageCost item={historyItem([usagePromptLog()])} />);
    expect(screen.getByText(/Claude Sonnet/)).toBeInTheDocument();
    // 12_000 + 4_000 = 16,000 tokens
    expect(screen.getByText(/16,000 tokens/)).toBeInTheDocument();
    // 12_000/1M * 3 + 4_000/1M * 15 = 0.096
    expect(screen.getByText(/\$0.0960/)).toBeInTheDocument();
  });

  it("omits cost for an unknown model", () => {
    render(
      <UsageCost
        item={historyItem([usagePromptLog({ model: "some-unknown-model" })])}
      />,
    );
    expect(screen.getByText(/16,000 tokens/)).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("aggregates tokens and cost across multiple prompt logs", () => {
    render(
      <UsageCost item={historyItem([usagePromptLog(), usagePromptLog()])} />,
    );
    expect(screen.getByText(/32,000 tokens/)).toBeInTheDocument();
    expect(screen.getByText(/\$0.1920/)).toBeInTheDocument();
  });
});
