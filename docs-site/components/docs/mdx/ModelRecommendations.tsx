const modelRecs: Record<
  string,
  { open: string[]; closed: string[]; notes: string }
> = {
  agent_plan: {
    open: [
      "[Qwen3 Coder (480B)](https://continue.dev/openrouter/qwen3-coder)",
      "[Qwen3 Coder (30B)](https://continue.dev/ollama/qwen3-coder-30b)",
      "[Devstral (27B)](https://continue.dev/ollama/devstral)",
      "[Kimi K2 (1T)](https://continue.dev/openrouter/kimi-k2)",
    ],
    closed: [
      "[Claude Opus 4.1](https://continue.dev/anthropic/claude-4-1-opus)",
      "[Claude Sonnet 4.6](https://continue.dev/anthropic/claude-sonnet-4-6)",
      "[GPT-5](https://continue.dev/openai/gpt-5)",
      "[Gemini 2.5 Pro](https://continue.dev/google/gemini-2.5-pro)",
    ],
    notes: "Closed models are slightly better than open models",
  },
  chat_edit: {
    open: [
      "[Qwen3 Coder (480B)](https://continue.dev/openrouter/qwen3-coder)",
      "[Qwen3 Coder (30B)](https://continue.dev/ollama/qwen3-coder-30b)",
    ],
    closed: [
      "[Claude Opus 4.1](https://continue.dev/anthropic/claude-4-1-opus)",
      "[Claude Sonnet 4.6](https://continue.dev/anthropic/claude-sonnet-4-6)",
      "[GPT-5](https://continue.dev/openai/gpt-5)",
      "[Gemini 2.5 Pro](https://continue.dev/google/gemini-2.5-pro)",
    ],
    notes: "Closed and open models have similar performance",
  },
  autocomplete: {
    open: [
      "[QwenCoder2.5 (1.5B)](https://continue.dev/ollama/qwen2.5-coder-1.5b)",
      "[QwenCoder2.5 (7B)](https://continue.dev/ollama/qwen2.5-coder-7b)",
    ],
    closed: [
      "[Codestral](https://continue.dev/mistral/codestral)",
      "[Mercury Coder](https://continue.dev/inception/mercury-coder)",
    ],
    notes: "Closed models are slightly better than open models",
  },
  apply: {
    open: ["[FastApply](https://continue.dev/mdpauley/fast-apply-15b-v10)"],
    closed: [
      "[Relace Instant Apply](https://continue.dev/relace/instant-apply)",
      "[Morph Fast Apply](https://continue.dev/morphllm/morph-v2)",
    ],
    notes: "Closed models are better than open models",
  },
  embed: {
    open: [
      "[Nomic Embed Text](https://continue.dev/ollama/nomic-embed-text-latest)",
    ],
    closed: [
      "[Voyage Code 3](https://continue.dev/voyageai/voyage-code-3)",
      "[Morph Embeddings](https://continue.dev/morphllm/morph-embedding-v2)",
    ],
    notes: "Closed models are slightly better than open models",
  },
  rerank: {
    open: ["zerank-1", "zerank-1-small"],
    closed: [
      "[Voyage Rerank 2.5](https://continue.dev/voyageai/rerank-2-5)",
      "[Morph Rerank](https://continue.dev/morphllm/morph-rerank-v2)",
    ],
    notes: "Open models are beginning to emerge for this model role",
  },
};

function parseMarkdownLinks(text: string) {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    parts.push(
      <a
        key={key++}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline"
      >
        {match[1]}
      </a>,
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : text;
}

export function ModelRecommendations({ role = "all" }: { role?: string }) {
  let rolesToShow: string[];

  if (!role || role === "all") {
    rolesToShow = Object.keys(modelRecs);
  } else {
    const key = role.toLowerCase().replace(/[\s/]/g, "_").replace(/-/g, "_");
    rolesToShow = modelRecs[key] ? [key] : [];
  }

  if (rolesToShow.length === 0) {
    return <div>No recommendations found for role: {role}</div>;
  }

  return (
    <div className="my-4 overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Model role</th>
            <th>Best open models</th>
            <th>Best closed models</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rolesToShow.map((roleKey) => {
            const rec = modelRecs[roleKey];
            if (!rec) return null;
            return (
              <tr key={roleKey}>
                <td className="font-semibold">
                  {roleKey
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </td>
                <td>
                  {rec.open.map((m, i) => (
                    <div key={i} className="mb-1">
                      {parseMarkdownLinks(m)}
                    </div>
                  ))}
                </td>
                <td>
                  {rec.closed.map((m, i) => (
                    <div key={i} className="mb-1">
                      {parseMarkdownLinks(m)}
                    </div>
                  ))}
                </td>
                <td>{rec.notes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
