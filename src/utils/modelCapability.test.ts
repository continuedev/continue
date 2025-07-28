import { isModelCapable } from './modelCapability.js';

describe('isModelCapable', () => {
  describe('OpenAI models', () => {
    test('should consider GPT-4 models as capable', () => {
      expect(isModelCapable('openai', 'gpt-4')).toBe(true);
      expect(isModelCapable('openai', 'gpt-4-turbo')).toBe(true);
      expect(isModelCapable('openai', 'gpt-4-0613')).toBe(true);
    });

    test('should consider GPT-3.5-turbo as capable', () => {
      expect(isModelCapable('openai', 'gpt-3.5-turbo')).toBe(true);
      expect(isModelCapable('openai', 'gpt-3.5-turbo-16k')).toBe(true);
    });

    test('should consider older GPT-3 models as less capable', () => {
      expect(isModelCapable('openai', 'gpt-3-davinci')).toBe(false);
      expect(isModelCapable('openai', 'gpt-3-curie')).toBe(false);
    });
  });

  describe('Anthropic models', () => {
    test('should consider Claude-3 models as capable', () => {
      expect(isModelCapable('anthropic', 'claude-3-opus')).toBe(true);
      expect(isModelCapable('anthropic', 'claude-3-sonnet')).toBe(true);
    });

    test('should consider Claude-2 as capable', () => {
      expect(isModelCapable('anthropic', 'claude-2')).toBe(true);
      expect(isModelCapable('anthropic', 'claude-2.1')).toBe(true);
    });

    test('should consider Claude-1 as less capable', () => {
      expect(isModelCapable('anthropic', 'claude-1')).toBe(false);
    });
  });

  describe('Google models', () => {
    test('should consider Gemini Pro models as capable', () => {
      expect(isModelCapable('google', 'gemini-pro')).toBe(true);
      expect(isModelCapable('gemini', 'gemini-ultra')).toBe(true);
    });

    test('should consider PaLM-2 models as capable', () => {
      expect(isModelCapable('google', 'palm-2-chat')).toBe(true);
    });
  });

  describe('Local/Ollama models', () => {
    test('should consider larger models as capable', () => {
      expect(isModelCapable('ollama', 'llama2-70b')).toBe(true);
      expect(isModelCapable('local', 'codellama-34b')).toBe(true);
    });

    test('should consider smaller models as less capable', () => {
      expect(isModelCapable('ollama', 'llama2-7b')).toBe(false);
      expect(isModelCapable('local', 'mistral-7b')).toBe(false);
    });
  });

  describe('Meta/Llama models', () => {
    test('should consider large Llama models as capable', () => {
      expect(isModelCapable('llama', 'llama-2-70b')).toBe(true);
      expect(isModelCapable('meta', 'llama-65b')).toBe(true);
    });

    test('should consider small Llama models as less capable', () => {
      expect(isModelCapable('llama', 'llama-2-7b')).toBe(false);
      expect(isModelCapable('meta', 'llama-13b')).toBe(false);
    });
  });

  describe('Continue Proxy models', () => {
    test('should consider continue-proxy models as capable', () => {
      expect(isModelCapable('continue-proxy', 'any-model')).toBe(true);
    });
  });

  describe('Hugging Face models', () => {
    test('should consider code-specific models as capable', () => {
      expect(isModelCapable('huggingface', 'codellama-instruct')).toBe(true);
      expect(isModelCapable('huggingface', 'starcoder-base')).toBe(true);
    });

    test('should consider general chat models as less capable', () => {
      expect(isModelCapable('huggingface', 'falcon-7b')).toBe(false);
    });
  });

  describe('Unknown providers', () => {
    test('should default to capable for unknown providers', () => {
      expect(isModelCapable('unknown-provider', 'some-model')).toBe(true);
    });
  });

  describe('Case insensitivity', () => {
    test('should handle different cases correctly', () => {
      expect(isModelCapable('OPENAI', 'GPT-4')).toBe(true);
      expect(isModelCapable('OpenAI', 'Gpt-4-Turbo')).toBe(true);
      expect(isModelCapable('anthropic', 'CLAUDE-3-OPUS')).toBe(true);
    });
  });
});