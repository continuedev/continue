import { BaseLLM } from "../index.js";
import { ChatMessage, CompletionOptions, LLMOptions, ModelProvider } from "../../index.js";
import { streamJSON } from "../stream.js";


class IBM extends BaseLLM {
	private conversationId?: string;
	private parentId?: string;

	static providerName: ModelProvider = "ibm";

	static defaultOptions: Partial<LLMOptions> = {
		apiBase: "https://bam-api.res.ibm.com/v2/",
		apiVersion: "2024-05-23",
	};

	private static MODEL_IDS: { [name: string]: string } = {
		"granite-3b-code-instruct": "ibm/granite-3b-code-instruct",
		"granite-8b-code-instruct": "ibm/granite-8b-code-instruct",
		"granite-34b-code-instruct": "ibm/granite-34b-code-instruct",
	};

	private _getModelName(model: string) {
		return IBM.MODEL_IDS[model] || this.model;
	}

	private _convertArgs(options: CompletionOptions) {
		const finalOptions = {
			model_id: this._getModelName(this.model),
			conversationId: this.conversationId,
			parentId: this.parentId,
			parameters: {
				temperature: this.completionOptions.temperature,
				min_new_tokens: 1,
				max_new_tokens: this.completionOptions.maxTokens,
				stop_sequences: this.completionOptions.stop,
				include_stop_sequence: false
			},
		};

		return finalOptions;
	}

	protected async *_streamChat(
		messages: ChatMessage[],
		options: CompletionOptions,
	): AsyncGenerator<ChatMessage> {
		const response = await this.fetch(new URL(`${this.apiBase}chat?version=${this.apiVersion}`), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				...this._convertArgs(options),
				messages: (messages),
				system: this.systemMessage,
			}),
		});

		if (options.stream === false) {
			const data = await response.json();
			yield { role: "assistant", content: data.text };
			return;
		}

		for await (const value of streamJSON(response)) {
			if (value.event_type === "text-generation") {
				yield { role: "assistant", content: value.text };
			}
		}
	}
}

export default IBM;
