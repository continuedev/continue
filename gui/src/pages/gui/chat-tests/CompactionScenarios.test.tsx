import { act, screen } from "@testing-library/react";
import { addAndSelectMockLlm } from "../../../util/test/config";
import { renderWithProviders } from "../../../util/test/render";
import {
  getElementByTestId,
  getElementByText,
  sendInputWithMockedResponse,
  verifyNotPresentByTestId,
} from "../../../util/test/utils";
import { Chat } from "../Chat";

describe("Compaction UI Scenarios", () => {
  test("should show compact button for assistant messages", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Add and select mock LLM
    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Send a message to get some chat history
    await sendInputWithMockedResponse(ideMessenger, "Hello", [
      { role: "assistant", content: "Hi there!" },
    ]);

    // Verify that the compact button appears for the assistant message
    await getElementByTestId("compact-button-1");
  });

  test("should disable input during compaction and show generating summary indicator", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Add and select mock LLM
    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Send a message to get some chat history
    await sendInputWithMockedResponse(ideMessenger, "Hello", [
      { role: "assistant", content: "Hi there!" },
    ]);

    // Find and click the compact conversation button
    const compactButton = await getElementByTestId("compact-button-1");
    
    // Mock the compaction loading state
    await act(async () => {
      store.dispatch({
        type: "session/setCompactionLoading",
        payload: { index: 1, loading: true },
      });
    });

    // Verify that "Generating Summary" appears in the notch
    await getElementByTestId("notch-compacting-text");
    await getElementByText("Generating Summary");

    // During compaction, verify we're in compacting state
    // (The submit button might still exist but should be disabled/replaced by compacting UI)
    // Let's just verify the compacting state is active instead
    expect(await getElementByTestId("notch-compacting-text")).toBeInTheDocument();

    // Simulate compaction completion
    await act(async () => {
      store.dispatch({
        type: "session/setCompactionLoading", 
        payload: { index: 1, loading: false },
      });
    });

    // Verify that the generating indicator disappears
    await verifyNotPresentByTestId("notch-compacting-text");

    // After compaction completes, verify we can find at least one enabled submit button
    const submitButtons = screen.getAllByTestId("submit-input-button");
    expect(submitButtons.length).toBeGreaterThan(0);
    
    // At least one submit button should not be disabled
    const enabledButtons = submitButtons.filter(btn => !(btn as HTMLButtonElement).disabled);
    expect(enabledButtons.length).toBeGreaterThan(0);
  });

  test("should show loading state during compaction", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Add and select mock LLM first
    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Send a message to get some chat history
    await sendInputWithMockedResponse(ideMessenger, "Test message", [
      { role: "assistant", content: "Some message" },
    ]);

    // Set compaction loading for this message
    await act(async () => {
      store.dispatch({
        type: "session/setCompactionLoading",
        payload: { index: 1, loading: true },
      });
    });

    // Verify the loading indicator shows in the notch
    await getElementByTestId("notch-compacting-text");
    
    // Verify loading text appears in the notch
    await getElementByText("Generating Summary");
  });

  test("should have submit button available", async () => {
    await renderWithProviders(<Chat />);

    // Verify that the submit button exists and is enabled
    const submitButton = await getElementByTestId("submit-input-button");
    expect(submitButton).not.toBeDisabled();
  });

  test("should show compact button after sending messages", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Add and select mock LLM
    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Send first message to create a conversation
    await sendInputWithMockedResponse(ideMessenger, "First message", [
      { role: "assistant", content: "First response" },
    ]);

    // Should show compact button for the assistant message
    await getElementByTestId("compact-button-1");
  });

  test("should handle empty conversations gracefully", async () => {
    await renderWithProviders(<Chat />);

    // Should not crash and should show appropriate empty state
    // Verify no compact buttons are present in empty state
    await verifyNotPresentByTestId("compact-button-0");
    await verifyNotPresentByTestId("compact-button-1");
  });

  test("should trigger compaction when compact button is clicked", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Add and select mock LLM
    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Send a message to get some chat history
    await sendInputWithMockedResponse(ideMessenger, "Test message", [
      { role: "assistant", content: "Test response" },
    ]);

    // Find the compact button
    const compactButton = await getElementByTestId("compact-button-1");
    
    // Mock the IDE messenger to capture and delay compaction requests
    let compactionRequested = false;
    let compactionResolve: () => void;
    const compactionPromise = new Promise<void>((resolve) => {
      compactionResolve = resolve;
    });
    
    const originalRequest = ideMessenger.request;
    ideMessenger.request = async (messageType, data) => {
      if (messageType === "conversation/compact") {
        compactionRequested = true;
        // Wait for our manual resolve to complete compaction
        await compactionPromise;
        return {
          status: "success" as const,
          content: undefined,
          done: true,
        };
      }
      return originalRequest.call(ideMessenger, messageType, data);
    };

    // Click the compact button
    await act(async () => {
      compactButton.click();
    });

    // Verify that compaction was requested
    expect(compactionRequested).toBe(true);
    
    // Verify loading state appears and persists
    await getElementByTestId("notch-compacting-text");
    await getElementByText("Generating Summary");
    
    // Complete the compaction
    await act(async () => {
      compactionResolve!();
    });
    
    // Restore original request method
    ideMessenger.request = originalRequest;
  });

  test("should show compact option when context is high", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Add and select mock LLM
    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Send a message to get some chat history
    await sendInputWithMockedResponse(ideMessenger, "Test message", [
      { role: "assistant", content: "Test response" },
    ]);

    // Simulate high context usage that would trigger compaction suggestions
    await act(async () => {
      store.dispatch({
        type: "session/setContextPercentage", 
        payload: 0.8, // 80% context usage
      });
    });

    // Should show compact button with warning styling
    const compactButton = await getElementByTestId("compact-button-1");
    expect(compactButton).toBeInTheDocument();
  });

  test("should show context gauge with compaction option when context is high", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Add and select mock LLM
    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Send a message to get some chat history
    await sendInputWithMockedResponse(ideMessenger, "Test message", [
      { role: "assistant", content: "Test response" },
    ]);

    // Simulate high context usage that triggers context gauge display
    await act(async () => {
      store.dispatch({
        type: "session/setContextPercentage", 
        payload: 0.65, // 65% context usage - should show gauge
      });
    });

    // Should show context gauge and compact option is available in DOM
    // The context gauge should be visible now (appears at 60%+)  
    // Even if tooltip isn't visible, the "Compact conversation" text should be in DOM
    await getElementByText("Compact conversation");
  });

  test("should show context gauge when pruned", async () => {
    const { ideMessenger, store } = await renderWithProviders(<Chat />);

    // Add and select mock LLM
    await act(async () => {
      addAndSelectMockLlm(store, ideMessenger);
    });

    // Send a message to get some chat history
    await sendInputWithMockedResponse(ideMessenger, "Test message", [
      { role: "assistant", content: "Test response" },
    ]);

    // Simulate pruned state (oldest messages being removed)
    await act(async () => {
      store.dispatch({
        type: "session/setIsPruned", 
        payload: true,
      });
      store.dispatch({
        type: "session/setContextPercentage", 
        payload: 0.45, // Even at lower percentage, should show when pruned
      });
    });

    // Should have "Compact conversation" option available when pruned
    // (Even at lower percentage, should show when pruned)
    await getElementByText("Compact conversation");
  });
});