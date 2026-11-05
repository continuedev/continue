export const ModelRecommendations = ({ role = "all" }) => {
  const parseMarkdownLinks = (text) => {
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        if (beforeText) {
          parts.push(<span key={key++}>{beforeText}</span>);
        }
      }

      const [, linkText, url] = match;
      parts.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#0066cc", textDecoration: "underline" }}
        >
          {linkText}
        </a>,
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      if (remainingText) {
        parts.push(<span key={key++}>{remainingText}</span>);
      }
    }

    return parts.length > 0 ? parts : text;
  };

  // Model recommendations data inside component scope
  const modelRecs = {
    agent_plan: {
      open: [
        "Qwen3 Coder (480B)",
        "Qwen3 Coder (30B)",
        "Devstral (27B)",
        "Kimi K2 (1T)",
        "gpt-oss (120B)",
        "gpt-oss (20B)",
        "GLM 4.5 (355B)",
        "GLM 4.5 Air (106B)",
      ],
      closed: ["Claude Opus 4.1", "Claude Sonnet 4", "GPT-5", "Gemini 3.1 Pro"],
      notes: "Closed models are slightly better than open models",
    },
    chat_edit: {
      open: [
        "Qwen3 Coder (480B)",
        "Qwen3 Coder (30B)",
        "gpt-oss (120B)",
        "gpt-oss (20B)",
      ],
      closed: ["Claude Opus 4.1", "Claude Sonnet 4", "GPT-5", "Gemini 3.1 Pro"],
      notes: "Closed and open models have pretty similar performance",
    },
    autocomplete: {
      open: ["QwenCoder2.5 (1.5B)", "QwenCoder2.5 (7B)"],
      closed: ["Codestral", "Mercury Coder"],
      notes: "Closed models are slightly better than open models",
    },
    apply: {
      open: ["FastApply"],
      closed: ["Relace Instant Apply", "Morph Fast Apply"],
      notes: "Closed models are better than open models",
    },
    embed: {
      open: ["Nomic Embed Text", "Qwen3 Embedding"],
      closed: ["Voyage Code 3", "Morph Embeddings", "Codestral Embed"],
      notes: "Closed models are slightly better than open models",
    },
    rerank: {
      open: ["zerank-1", "zerank-1-small", "Qwen3 Reranker"],
      closed: ["Voyage Rerank 2.5", "Relace Code Rerank", "Morph Rerank"],
      notes: "Open models are beginning to emerge for this model role",
    },
    next_edit: {
      open: ["Instinct"],
      closed: ["Mercury Coder"],
      notes: "Closed models are better than open models",
    },
  };

  let rolesToShow = [];

  if (!role || role === "all") {
    rolesToShow = Object.keys(modelRecs);
  } else {
    const key = role.toLowerCase().replace(/\s|\//g, "_").replace(/-/g, "_");
    if (modelRecs[key]) {
      rolesToShow = [key];
    }
  }

  if (rolesToShow.length === 0) {
    return <div>No recommendations found for role: {role}</div>;
  }

  return (
    <table
      style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}
    >
      <thead>
        <tr>
          <th
            style={{
              textAlign: "left",
              borderBottom: "1px solid #ddd",
              padding: "8px",
            }}
          >
            Model role
          </th>
          <th
            style={{
              textAlign: "left",
              borderBottom: "1px solid #ddd",
              padding: "8px",
            }}
          >
            Best open models
          </th>
          <th
            style={{
              textAlign: "left",
              borderBottom: "1px solid #ddd",
              padding: "8px",
            }}
          >
            Best closed models
          </th>
          <th
            style={{
              textAlign: "left",
              borderBottom: "1px solid #ddd",
              padding: "8px",
            }}
          >
            Notes
          </th>
        </tr>
      </thead>
      <tbody>
        {rolesToShow.map((roleKey) => {
          const rec = modelRecs[roleKey];
          if (!rec) return null;

          return (
            <tr key={roleKey}>
              <td
                style={{
                  fontWeight: 600,
                  verticalAlign: "top",
                  padding: "8px",
                }}
              >
                {roleKey
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </td>
              <td style={{ padding: "8px", verticalAlign: "top" }}>
                {rec.open.map((m, i) => (
                  <div key={i} style={{ marginBottom: "4px" }}>
                    {parseMarkdownLinks(m)}
                  </div>
                ))}
              </td>
              <td style={{ padding: "8px", verticalAlign: "top" }}>
                {rec.closed.map((m, i) => (
                  <div key={i} style={{ marginBottom: "4px" }}>
                    {parseMarkdownLinks(m)}
                  </div>
                ))}
              </td>
              <td style={{ padding: "8px", verticalAlign: "top" }}>
                {rec.notes}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
