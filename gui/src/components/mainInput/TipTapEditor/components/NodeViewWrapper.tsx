import {
  NodeViewWrapper as TiptapNodeViewWrapper,
  NodeViewWrapperProps as TiptapNodeViewWrapperProps,
} from "@tiptap/react";
import React from "react";

interface NodeViewWrapperProps {
  children: React.ReactNode;
}

export const NodeViewWrapper: React.FC<NodeViewWrapperProps> = ({
  children,
}) => {
  // Not setting this as a "p" will cause issues with foreign keyboards
  // Documentation unavailable in air-gapped mode
  const nodeViewWrapperTag: TiptapNodeViewWrapperProps["as"] = "p";

  return (
    <TiptapNodeViewWrapper className="my-1.5" as={nodeViewWrapperTag}>
      {children}
    </TiptapNodeViewWrapper>
  );
};
