import { JSONContent } from "@tiptap/react";
import { useEffect, useState } from "react";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";
import useUpdatingRef from "./useUpdatingRef";

const emptyJsonContent = () => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
});

const MAX_HISTORY_LENGTH = 100;

// Completely isolated memory stores for different history types
// This ensures no crossover between edit and chat histories
const CHAT_HISTORY_STORE: JSONContent[] = [];
const EDIT_HISTORY_STORE: JSONContent[] = [];

// Initialize the history stores from localStorage (only do this once)
let storesInitialized = false;
function initializeStores() {
  
  if (!storesInitialized) {
    // Initialize chat history
    const chatHistory = getLocalStorage('inputHistory_chat');
    if (chatHistory) {
      CHAT_HISTORY_STORE.push(...chatHistory.slice(-MAX_HISTORY_LENGTH));
    }
    
    // Initialize edit history
    const editHistory = getLocalStorage('inputHistory_edit');
    if (editHistory) {
      EDIT_HISTORY_STORE.push(...editHistory.slice(-MAX_HISTORY_LENGTH));
    }
    
    storesInitialized = true;
  }
}


// Initialize stores immediately
initializeStores();

/**
 * Custom hook for managing input history with complete separation between history types
 */
export function useInputHistory(historyKey: string) {
  // Determine which history store to use
  const historyStore = historyKey === 'edit' ? EDIT_HISTORY_STORE : CHAT_HISTORY_STORE;
  const storageKey = historyKey === 'edit' ? 'inputHistory_edit' as const : 'inputHistory_chat' as const;
  
  // Use a reference to the appropriate history store
  const [inputHistory, setInputHistory] = useState<JSONContent[]>(historyStore);
  const [pendingInput, setPendingInput] = useState<JSONContent>(emptyJsonContent());
  const [currentIndex, setCurrentIndex] = useState(inputHistory.length);
  
  // Keep the view of history updated when the underlying store changes
  useEffect(() => {
    setInputHistory([...historyStore]);
    setCurrentIndex(historyStore.length);
  }, [historyStore.length]);

  function prev(currentInput: JSONContent) {
    if (currentIndex === inputHistory.length) {
      setPendingInput(currentInput);
    }

    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      return inputHistory[currentIndex - 1];
    }
    
    // Stay at the first history item if we're already there
    if (currentIndex === 0 && inputHistory.length > 0) {
      return inputHistory[0];
    }
    
    return currentInput;
  }

  function next() {
    if (currentIndex < inputHistory.length) {
      setCurrentIndex(currentIndex + 1);
      
      if (currentIndex === inputHistory.length - 1) {
        return pendingInput;
      }
      
      return inputHistory[currentIndex + 1];
    }
    
    // Stay at pending input if we're already at the end
    return pendingInput;
  }

  function add(inputValue: JSONContent) {
    setPendingInput(emptyJsonContent());

    // Don't add duplicates
    if (
      historyStore.length > 0 &&
      JSON.stringify(historyStore[historyStore.length - 1]) === JSON.stringify(inputValue)
    ) {
      setCurrentIndex(historyStore.length);
      return;
    }

    // Update the appropriate history store
    while (historyStore.length >= MAX_HISTORY_LENGTH) {
      historyStore.shift(); // Remove oldest items if we exceed the limit
    }
    historyStore.push(inputValue);
    
    // Update the view of history
    setInputHistory([...historyStore]);
    setCurrentIndex(historyStore.length);
    
    // Update localStorage
    setLocalStorage(storageKey, [...historyStore]);
  }

  const prevRef = useUpdatingRef(prev, [inputHistory]);
  const nextRef = useUpdatingRef(next, [inputHistory]);
  const addRef = useUpdatingRef(add, [inputHistory]);

  return { prevRef, nextRef, addRef };
}
