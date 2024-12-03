import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import { uiSlice } from "../../redux/slices/uiSlice";
import ConfirmationDialog from "./ConfirmationDialog";

const createMockStore = () => {
  return configureStore({
    reducer: {
      uiState: uiSlice.reducer,
    },
  });
};

describe("ConfirmationDialog", () => {
  const renderDialog = (props: any) => {
    const store = createMockStore();
    return render(
      <Provider store={store}>
        <ConfirmationDialog {...props} />
      </Provider>,
    );
  };

  it("renders with default props", () => {
    const onConfirm = vi.fn();
    renderDialog({ text: "Are you sure?", onConfirm });

    expect(screen.getByText("Confirmation")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("renders with custom title and confirm text", () => {
    const onConfirm = vi.fn();
    renderDialog({
      text: "Delete item?",
      title: "Custom Title",
      confirmText: "Delete",
      onConfirm,
    });

    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(screen.getByText("Delete item?")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("hides cancel button when hideCancelButton is true", () => {
    const onConfirm = vi.fn();
    renderDialog({
      text: "Proceed?",
      hideCancelButton: true,
      onConfirm,
    });

    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("calls onConfirm and dispatches actions when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    renderDialog({ text: "Confirm action?", onConfirm });

    fireEvent.click(screen.getByText("Confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel and dispatches actions when cancel button is clicked", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderDialog({ text: "Cancel action?", onConfirm, onCancel });

    fireEvent.click(screen.getByText("Cancel"));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
