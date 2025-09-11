import { screen, waitFor } from "@testing-library/dom";
import { act } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { ChatMessage } from "core";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";

function logDomText() {
  const bodyText = document.body.innerHTML;
  const parser = new DOMParser();
  const doc = parser.parseFromString(bodyText, "text/html");
  let cleaned = doc.body.textContent ?? "";
  cleaned = cleaned?.replace(
    "No resultsAaModelsRulesDocsPromptsToolsMCPCreate your first agent",
    "",
  );
  cleaned = cleaned?.replace(
    /[⌘Ctrl]+⏎ (?:No )?[Aa]ctive file⏎ Enter⏎Log in to access a free trial of theModels Add-OnLog in to Continue HubOr, configure your own models/,
    "",
  );
  cleaned = cleaned.replaceAll("Select model", "");
  cleaned = cleaned.replaceAll("Mock LLM", "");
  cleaned = cleaned.replaceAll(/^Chat|Chat$/g, "");
  console.log(cleaned || "No body content");
}

export function logAllTestIds() {
  const elements = document.querySelectorAll("*");

  const testIds = Array.from(elements)
    .map((el) => Array.from(el.attributes))
    .flat()
    .filter((a) => a.name === "data-testid")
    .map((a) => a.value);
  console.log("Available test ids", testIds);
}
export async function getElementByTestId(testId: string): Promise<HTMLElement> {
  try {
    const testIdElement = await waitFor(() => screen.findByTestId(testId));
    expect(testIdElement).toBeInTheDocument();
    return testIdElement;
  } catch (e) {
    logAllTestIds();
    throw new Error(`Element with testId "${testId}" not found`);
  }
}

export async function verifyNotPresentByTestId(testId: string): Promise<void> {
  const element = await waitFor(() => screen.queryByTestId(testId));
  expect(element).not.toBeInTheDocument();
}

export async function verifyNotPresentByText(text: string): Promise<void> {
  const element = screen.queryByText(text);
  expect(element).not.toBeInTheDocument();
}

export async function getElementByText(text: string): Promise<HTMLElement> {
  try {
    const textElement = await waitFor(() => screen.findByText(text));
    expect(textElement).toBeInTheDocument();
    return textElement;
  } catch (e) {
    logDomText();
    throw new Error(`Element with text "${text}" not found.`);
  }
}

export async function getMainEditor(): Promise<Editor> {
  const editorElement = await getElementByTestId("editor-input-main");
  if ("editor" in editorElement) {
    return editorElement.editor as Editor;
  } else {
    throw new Error("Main editor not found within editor container");
  }
}

export async function sendInputWithMockedResponse(
  ideMessenger: MockIdeMessenger,
  input: string,
  response: ChatMessage[],
): Promise<void> {
  // Setup the mock response before any actions
  ideMessenger.chatResponse = response;

  // Wait for the editor to be in the document
  const editor = await getMainEditor();

  // Find the submit button
  const sendButton = await getElementByTestId("submit-input-button");

  // Insert content into the editor
  await act(async () => {
    editor.commands.insertContent(input);
  });

  await getElementByText(input);

  // Click the send button
  await act(async () => {
    sendButton.click();
  });
}
