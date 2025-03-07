import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { selectDefaultModel } from '../redux/slices/configSlice';
import { setAnthropicBudgetTokens, setOpenAIReasoningEffort } from '../redux/slices/uiSlice';

/**
 * This hook initializes thinking settings when the model changes.
 * It runs at a high level in the component tree to ensure model-specific 
 * settings are loaded only once per model selection.
 */
export const useModelThinkingSettings = () => {
  const dispatch = useAppDispatch();
  const defaultModel = useAppSelector(selectDefaultModel);
  const lastModelRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Skip if no model is selected
    if (!defaultModel) return;
    
    // Generate a unique ID for this model
    const modelId = `${defaultModel.provider}-${defaultModel.model}`;
    
    // Only update settings if model has changed
    if (lastModelRef.current === modelId) return;
    
    // Update the lastModelRef to prevent future updates for the same model
    lastModelRef.current = modelId;
    
    // Initialize Anthropic thinking settings from model config
    if (
      defaultModel.provider === "anthropic" && 
      defaultModel.completionOptions?.thinking?.budget_tokens
    ) {
      dispatch(
        setAnthropicBudgetTokens(
          defaultModel.completionOptions.thinking.budget_tokens
        )
      );
    }
    
    // Initialize OpenAI reasoning effort from model config
    if (
      defaultModel.provider === "openai" && 
      defaultModel.completionOptions?.reasoning_effort
    ) {
      dispatch(
        setOpenAIReasoningEffort(
          defaultModel.completionOptions.reasoning_effort as "low" | "medium" | "high"
        )
      );
    }
  }, [defaultModel, dispatch]);
};
