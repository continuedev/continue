import { ChatMessage, LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

/**
 * Classe Dragonfly qui étend OpenAI pour gérer les spécificités de l'API Dragonfly
 */
class Dragonfly extends OpenAI {
  // Nom du fournisseur
  static providerName = "dragonfly";

  // Options par défaut
  static defaultOptions: Partial<LLMOptions> = {
    apiBase: "https://ai.dragonflygroup.fr/api/v1/",
    useLegacyCompletionsEndpoint: false,
  };

  /**
   * Indique si le modèle supporte les complétions
   */
  supportsCompletions(): boolean {
    return false;
  }

  /**
   * Convertit les arguments en fonction du type de modèle
   */
  protected _convertArgs(options: any, messages: ChatMessage[]) {
    if (this._isAnthropicModel(options.model)) {
      return this._convertAnthropicArgs(options, messages);
    }
    return super._convertArgs(options, messages);
  }

  /**
   * Vérifie si le modèle est de type Anthropic (commence par 'claude')
   */
  private _isAnthropicModel(model?: string): boolean {
    return model?.toLowerCase().startsWith('claude') ?? false;
  }

  /**
   * Convertit les arguments pour le format Anthropic
   */
  private _convertAnthropicArgs(options: any, messages: ChatMessage[]) {
    const convertedMessages = this._convertAnthropicMessages(messages);
    
    // Préparation des options finales
    const finalOptions = {
      ...options,
      messages: convertedMessages,
      stream: options.stream ?? true,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature,
      stop_sequences: options.stop?.filter((x: string) => x.trim() !== ""),
    };

    // Ajout du message système si présent
    if (this.systemMessage) {
      finalOptions.system = [{
        type: "text",
        text: this.systemMessage,
        cache_control: { type: "ephemeral" }
      }];
    }

    return finalOptions;
  }

  /**
   * Convertit les messages au format Anthropic
   */
  private _convertAnthropicMessages(messages: ChatMessage[]): any[] {
    // Exclusion des messages système
    const filteredMessages = messages.filter(m => m.role !== "system" && !!m.content);
    
    // Identification des deux derniers messages utilisateur pour le cache
    const lastTwoUserMsgIndices = filteredMessages
      .map((msg, index) => msg.role === "user" ? index : -1)
      .filter(index => index !== -1)
      .slice(-2);

    return filteredMessages.map((message, index) => {
      const shouldCache = lastTwoUserMsgIndices.includes(index);
      
      // Gestion des messages d'outils
      if (message.role === "tool") {
        return {
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: message.toolCallId,
            content: message.content
          }]
        };
      }

      // Gestion des appels d'outils par l'assistant
      if (message.role === "assistant" && message.toolCalls) {
        return {
          role: "assistant",
          content: message.toolCalls.map(toolCall => ({
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.function?.name,
            input: JSON.parse(toolCall.function?.arguments || "{}")
          }))
        };
      }

      // Gestion du contenu texte simple
      if (typeof message.content === "string") {
        return {
          role: message.role,
          content: [{
            type: "text",
            text: message.content,
            ...(shouldCache ? { cache_control: { type: "ephemeral" } } : {})
          }]
        };
      }

      // Gestion du contenu mixte (texte + images)
      return {
        role: message.role,
        content: message.content.map((part, contentIdx) => {
          if (part.type === "text") {
            return {
              type: "text",
              text: part.text,
              ...(shouldCache && contentIdx === message.content.length - 1
                ? { cache_control: { type: "ephemeral" } }
                : {})
            };
          }
          return {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: part.imageUrl?.url.split(",")[1],
            },
          };
        })
      };
    });
  }
}

export default Dragonfly;