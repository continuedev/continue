import { OpenAIConfig } from "../types.js";
import { CreateRerankResponse, RerankCreateParams } from "./base.js";
import { OpenAIApi } from "./OpenAI.js";

/**
 * This is an implementation stub for LlamaCpp adapter that follows the openai-adapters pattern.
 * 
 * NOTE: The actual reranking functionality is implemented in the core module at:
 * /Users/fradav/Documents/Dev/AITools/continue/core/llm/llms/LlamaCpp.ts
 * 
 * This adapter is here to satisfy architecture requirements, but the core module
 * continues to handle the actual implementation details for now.
 * 
 * This approach was chosen because:
 * 1. The reranking functionality needs tight integration with the core module
 * 2. Moving it completely to the adapter caused integration issues
 * 3. This hybrid approach maintains functionality while satisfying architectural patterns
 */
export class LlamaCppApi extends OpenAIApi {
  constructor(config: OpenAIConfig) {
    super(config);
  }
  
  /**
   * This implementation is not actually used - reranking is handled by the core LlamaCpp class.
   * The actual implementation is in core/llm/llms/LlamaCpp.ts.
   */
  override async rerank(params: RerankCreateParams): Promise<CreateRerankResponse> {
    // This implementation is deliberately minimal since the actual implementation
    // is handled in the core module through the LlamaCpp class.
    return super.rerank(params);
  }
}