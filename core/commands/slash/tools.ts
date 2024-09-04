import OpenAI from "openai";
import {
  SlashCommand,
  Tool,
  ContinueSDK,
  ContextItemWithId,
  ILLM,
} from "../../index.js";
import { countTokens } from "../../llm/countTokens.js";
import { DEFAULT_MAX_TOKENS } from "../../llm/constants.js";

const requestOpenai = async (
  client: OpenAI,
  model: ILLM,
  openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
  openAiTools: OpenAI.Chat.ChatCompletionTool[],
) => {
  const createParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
    {
      model: model.model,
      max_tokens: model.completionOptions.maxTokens,
      messages: openAiMessages,
      tools: openAiTools,
      tool_choice: "auto",
    };
  let completion: OpenAI.Chat.Completions.ChatCompletion;
  completion = await client.chat.completions.create(createParams);
  const usage = completion.usage;
  const prompt_tokens = usage?.prompt_tokens ?? 0;
  const completion_tokens = usage?.completion_tokens ?? 0;
  return {
    prompt_tokens: prompt_tokens,
    completion_tokens: completion_tokens,
    message: completion.choices[0].message,
  };
};

function findContextProvider(sdk: ContinueSDK, provider_name: string) {
  return sdk.config.contextProviders?.find(
    (provider) => provider.description.title === provider_name,
  );
}

async function callContextProviders(
  query: string,
  sdk: ContinueSDK,
  provider_name: string,
) {
  const provider = findContextProvider(sdk, provider_name);
  if (!provider) {
    return `Cannot find tool: "${provider_name}"`;
  }
  try {
    const context = await provider?.getContextItems(query, {
      config: sdk.config,
      fullInput: query,
      llm: sdk.llm,
      embeddingsProvider: sdk.config.embeddingsProvider,
      ide: sdk.ide,
      selectedCode: [],
      reranker: sdk.config.reranker,
      fetch: sdk.fetch,
    });
    if (context && context.length > 0) {
      return context.at(0)?.content;
    }
    return "Empty";
  } catch (e) {
    return "Error";
  }
}

export function adjustMessagesLength(
  model: ILLM,
  contextLength: number,
  systemPrompt: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  tools: Tool[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const adjustedContextLength = contextLength - 10_000;
  const systemPromptTokens = countTokens(systemPrompt);
  const toolsTokens = countTokens(JSON.stringify(tools));
  let availableTokens =
    adjustedContextLength - systemPromptTokens - toolsTokens;

  let totalMessageTokens = messages.reduce(
    (sum, message) =>
      sum +
      model.countTokens(
        typeof message.content == "string" ? message.content : "",
      ),
    0,
  );

  if (totalMessageTokens <= availableTokens) {
    return messages;
  }

  const newMessages = [...messages];
  let index = 3;
  while (totalMessageTokens > availableTokens && index < newMessages.length) {
    const adjustMessage = newMessages[index];
    const originalTokens = countTokens(
      typeof adjustMessage.content == "string" ? adjustMessage.content : "",
    );
    if (adjustMessage.role == "assistant" && adjustMessage.content) {
      adjustMessage.content = "(truncated due to context length limit)";
    } else if (adjustMessage.role == "tool") {
      adjustMessage.content = "(truncated due to context length limit)";
    }
    const newTokens = countTokens(
      typeof adjustMessage.content == "string" ? adjustMessage.content : "",
    );
    totalMessageTokens -= originalTokens - newTokens;
    index++;
  }
  return newMessages;
}

const ToolsCommand: SlashCommand = {
  name: "tools",
  description: "Use tools to complete tasks",
  run: async function* (sdk) {
    const { llm, input, config, params, addContextItem } = sdk;

    const tools: Tool[] = [];
    const defaultParameters = {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The input query.",
        },
      },
      required: ["query"],
    };
    const availableTools =
      params?.availableTools ??
      config.contextProviders?.map((item) => ({
        name: item.description.title,
      }));
    for (const tool of availableTools) {
      const provider = findContextProvider(sdk, tool.name);
      if (provider) {
        tools.push({
          function: {
            name: tool.name,
            description: tool.description ?? provider.description.description,
            parameters: tool.parameters ?? defaultParameters,
          },
          type: "function",
        });
      }
    }

    tools.push({
      function: {
        name: "complete_task",
        description:
          "Once you've completed the task, use this tool to notify the user.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      type: "function",
    });

    const defaultSystemPrompt = "You are a helpful assistant.";

    const systemPrompt = params?.systemPrompt ?? defaultSystemPrompt;
    let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: input.replace("/tools", ""),
      },
    ];

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let endTask = false;
    const contextLength = llm.contextLength;
    const maxRequests = params?.maxRequests ?? 10;
    const maxTokens = llm.completionOptions.maxTokens ?? DEFAULT_MAX_TOKENS;
    const isDebug = params?.debug ?? false;

    const client = new OpenAI({
      baseURL: llm.apiBase,
      apiKey: llm.apiKey,
    });

    for (let i = 0; i <= maxRequests; i++) {
      messages = adjustMessagesLength(
        llm,
        contextLength,
        systemPrompt,
        messages,
        tools,
      );
      const response = await requestOpenai(client, llm, messages, tools);
      const openAiMessage = response.message;
      totalPromptTokens += response.prompt_tokens;
      totalCompletionTokens += response.completion_tokens;
      messages.push(openAiMessage);

      if (openAiMessage.content) {
        yield openAiMessage.content + "  \n";
      }
      if (openAiMessage.tool_calls && openAiMessage.tool_calls.length > 0) {
        for (const _tool_calls of openAiMessage.tool_calls) {
          const toolCallId = _tool_calls.id;
          const toolName = _tool_calls.function.name;
          if (toolName == "complete_task") {
            endTask = true;
            break;
          }
          const toolInput = JSON.parse(_tool_calls.function.arguments || "{}");

          const tool_result = await callContextProviders(
            toolInput.query,
            sdk,
            toolName,
          );

          const contextItem: ContextItemWithId = {
            id: { providerTitle: toolName, itemId: toolName },
            name: toolName,
            description: toolName,
            content: `parameters: \n${JSON.stringify(toolInput)}\n${"*".repeat(
              20,
            )}\nresult: \n${tool_result}`,
          };
          addContextItem(contextItem);

          const function_call_result_message: OpenAI.Chat.ChatCompletionToolMessageParam =
            {
              role: "tool",
              content: JSON.stringify({
                result: {
                  tool: toolName,
                  arguments: toolInput,
                  cotent: tool_result,
                },
              }),
              tool_call_id: toolCallId,
            };
          messages.push(function_call_result_message);
        }
      } else {
        endTask = true;
        break;
      }
      if (endTask) {
        break;
      }
      if (
        response.prompt_tokens > contextLength ||
        response.completion_tokens > maxTokens
      ) {
        break;
      }
    }
    if (isDebug) {
      yield `total prompt tokens: ${totalPromptTokens}, total completion tokens: ${totalCompletionTokens}  \n`;
    }
  },
};

export default ToolsCommand;
