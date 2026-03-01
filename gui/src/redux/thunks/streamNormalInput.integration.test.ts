import { describe, expect, it, vi } from "vitest";

describe("streamNormalInput integration - chatResponseWithTodos", () => {
  it("posts chatResponseWithTodos when LLM emits JSON todos", async () => {
    // Provide a minimal localStorage mock before importing modules that read it at module-load
    (globalThis as any).localStorage = {
      store: new Map<string, string>(),
      getItem(key: string) {
        return (this.store.get(key) as string) ?? null;
      },
      setItem(key: string, value: string) {
        this.store.set(key, String(value));
      },
      removeItem(key: string) {
        this.store.delete(key);
      },
      clear() {
        this.store.clear();
      },
    } as any;

    const { createMockStore, getEmptyRootState } = await import(
      "../../util/test/mockStore"
    );

    const { streamNormalInput } = await import("./streamNormalInput");
    const initialState = getEmptyRootState();
    initialState.config.config.selectedModelByRole.chat = {
      title: "gpt-4o",
      model: "gpt-4o",
      underlyingProviderName: "openai",
      contextLength: 128000,
      completionOptions: {},
    } as any;

    const mockStore = createMockStore(initialState);

    mockStore.mockIdeMessenger.responses["llm/compileChat"] = {
      compiledChatMessages: [],
      didPrune: false,
      contextPercentage: 0,
    } as any;

    // Mock ideMessenger.llmStreamChat to yield assistant message with todos JSON
    async function* mockGen() {
      yield [
        {
          role: "assistant",
          content: JSON.stringify({
            summary: "Summary",
            todos: [
              { text: "task1", order: 0 },
              { text: "task2", order: 1 },
            ],
            actions: [],
          }),
        },
      ];
      return;
    }

    mockStore.mockIdeMessenger.llmStreamChat = vi
      .fn()
      .mockReturnValue(mockGen());

    const postSpy = vi.spyOn(mockStore.mockIdeMessenger, "post");

    await mockStore.dispatch(streamNormalInput({}) as any);

    // Expect post called with chatResponseWithTodos
    expect(postSpy).toHaveBeenCalled();
    const calledWith = postSpy.mock.calls.find(
      (c: any) => c[0] === "chatResponseWithTodos",
    );
    expect(calledWith).toBeTruthy();
    const payload = calledWith![1];
    expect(payload.todos).toHaveLength(2);
    expect(payload.todos[0].text).toBe("task1");
  }, 20000);
});
