import { useAppSelector } from "../../redux/hooks";
import { RootState } from "../../redux/store";

export default function AboutAssistantDialog() {
  const configJson = useAppSelector((store: RootState) => store.config.config);

  const selectedProfileId = useAppSelector(
    (store) => store.session.selectedProfileId,
  );

  return (
    <div className="h-[60vh] space-y-4 overflow-y-scroll px-4 pb-4">
      <h2>About {selectedProfileId} assistant</h2>
      {configJson.models?.length > 0 && (
        <details>
          <summary>Chat models</summary>
          <ul>
            {configJson.models.map((model, index) => (
              <li key={index}>{model.title}</li>
            ))}
          </ul>
        </details>
      )}

      {configJson.embeddingsProvider && (
        <details>
          <summary>Embedding model</summary>
          <p>{configJson.embeddingsProvider}</p>
        </details>
      )}

      {configJson.reranker?.name && (
        <details>
          <summary>Rerank model</summary>
          <p>{configJson.reranker.name}</p>
        </details>
      )}

      {configJson.systemMessage && (
        <details>
          <summary>Rules</summary>
          <p>{configJson.systemMessage}</p>
        </details>
      )}

      {configJson.contextProviders?.length ? (
        <details>
          <summary>Context</summary>
          <ul>
            {configJson.contextProviders.map((provider, index) => (
              <li key={index}>{provider.title}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {configJson.tools.length > 0 && (
        <details>
          <summary>Tools</summary>
          <ul>
            {configJson.tools.map((tool, index) => (
              <li key={index}>{tool.displayTitle}</li>
            ))}
          </ul>
        </details>
      )}

      {configJson.docs?.length ? (
        <details>
          <summary>Docs</summary>
          <ul>
            {configJson.docs.map((doc, index) => (
              <li key={index}>{doc.title}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
