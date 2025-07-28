import { screen } from "@testing-library/react";
import { NodeViewProps } from "@tiptap/react";
import { ContextItemWithId } from "core";
import { beforeEach, describe, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../util/test/render";
import { CodeBlockPreview } from "./CodeBlockPreview";

const postIde = vi.fn();

vi.mock("../../../../../context/MockIdeMessenger", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    MockIdeMessenger: class MockedMockIdeMessenger extends original.MockIdeMessenger {
      post(...args: any[]) {
        postIde(...args);
      }
    },
  };
});

describe("CodeBlockPreview", () => {
  const createMockContextItem = (
    overrides: Partial<ContextItemWithId> = {},
  ): ContextItemWithId => ({
    content: "console.log('test');",
    name: "test.ts",
    description: "Test file",
    id: {
      providerTitle: "file",
      itemId: "test-item-id",
    },
    uri: {
      type: "file",
      value: "/test/test.ts",
    },
    ...overrides,
  });

  const createMockNodeViewProps = (
    item: ContextItemWithId,
    selected = false,
  ): NodeViewProps => ({
    node: {
      attrs: {
        item,
      },
    } as any,
    view: {} as any,
    getPos: vi.fn(() => 0),
    innerDecorations: {} as any,
    editor: {} as any,
    extension: {} as any,
    HTMLAttributes: {},
    decorations: [] as any,
    selected,
    updateAttributes: vi.fn(),
    deleteNode: vi.fn(),
  });

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("opens file when title is clicked", async () => {
    const item = createMockContextItem({
      id: { providerTitle: "file", itemId: "test-id" },
      uri: { type: "file", value: "/test/file.ts" },
      name: "test.ts",
    });
    const props = createMockNodeViewProps(item);

    await renderWithProviders(<CodeBlockPreview {...props} />);

    const title = screen.getByText("test.ts");
    title.click();

    expect(postIde).toHaveBeenCalled();
    expect(postIde).toHaveBeenCalledWith("showFile", {
      filepath: "/test/file.ts",
    });
  });
});
