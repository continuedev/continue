import crypto from 'crypto';
import { ModelInfo } from 'core/granite/commons/modelInfo';
import { formatSize } from 'core/granite/commons/textUtils';

const cache = new Map<string, ModelInfo | undefined>();//TODO limit caching lifespan

export async function getRemoteModelInfo(modelId: string): Promise<ModelInfo | undefined> {
  // Check if the result is already cached
  if (cache.has(modelId)) {
    return cache.get(modelId);
  }
  const start = Date.now();
  const [modelName, tag] = modelId.split(":");
  const url = `https://registry.ollama.ai/v2/library/${modelName}/manifests/${tag}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });

    if (!response.ok) {
      throw new Error(`Failed to fetch the model page: ${response.statusText}`);
    }

    // First, read the response body as an ArrayBuffer to compute the digest
    const buffer = await response.arrayBuffer();
    const digest = getDigest(buffer);

    // Then, decode the ArrayBuffer into a string and parse it as JSON
    const text = new TextDecoder().decode(buffer);
    const manifest = JSON.parse(text) as { layers: { size: number }[] };
    const modelSize = manifest.layers.reduce((sum, layer) => sum + layer.size, 0);

    const data: ModelInfo = {
      id: modelId,
      size: formatSize(modelSize),
      digest
    };
    // Cache the successful result
    cache.set(modelId, data);
    console.log('Model info:', data);
    return data;
  } catch (error) {
    console.error(`Error fetching or parsing model info: ${error}`);
  } finally {
    const elapsed = Date.now() - start;
    console.log(`Fetched remote information for ${modelId} in ${elapsed} ms`);
  }

  // Cache the failure
  cache.set(modelId, undefined);
  return undefined;
}

function getDigest(buffer: ArrayBuffer): string {
  const hash = crypto.createHash('sha256');
  hash.update(Buffer.from(buffer));
  return hash.digest('hex');
}